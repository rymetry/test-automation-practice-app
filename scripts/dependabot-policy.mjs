import { isDeepStrictEqual } from 'node:util';

const leafPackages = new Set([
  '@cloudflare/workers-types',
  '@fontsource/ibm-plex-sans',
]);
const graphTools = new Set([
  'vite',
  'wrangler',
  '@cloudflare/vite-plugin',
  'typescript',
]);
const allowedExistingInstallScripts = new Set([
  'workerd',
  'esbuild',
  'fsevents',
]);
const expectedFiles = ['package-lock.json', 'package.json'];
const maxLockPackages = 2000;
const maxLockChanges = 200;
const registryConcurrency = 8;
const registryTimeoutMs = 15000;
const nameOf = (path) => path.split('/node_modules/').at(-1).replace(/^node_modules\//, '');
const parentOf = (path) => path.includes('/node_modules/') ? path.slice(0, path.lastIndexOf('/node_modules/')) : '';
const npmName = /^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/;
const npmVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const npmIntegrity = /^sha512-[A-Za-z0-9+/]{86}==$/;
const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta'];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

export function checkRun({ run, repo, pr, base, commit, rules }) {
  const ref = Array.isArray(run.pull_requests) && run.pull_requests.length === 1
    ? run.pull_requests[0]
    : null;
  const head = run.head_sha;
  requireCondition(run.event === 'pull_request' && run.conclusion === 'success'
    && run.path === '.github/workflows/pr-ci.yml'
    && run.actor?.login === 'dependabot[bot]'
    && run.head_repository?.full_name === repo
    && /^[a-f0-9]{40}$/.test(head)
    && ref?.number === pr.number, 'PR CI の実行元または紐づけを確認できません');
  requireCondition(pr.state === 'open' && pr.draft === false
    && pr.user?.login === 'dependabot[bot]' && pr.user?.type === 'Bot'
    && pr.base?.repo?.full_name === repo && pr.base?.ref === 'main'
    && pr.head?.repo?.full_name === repo && pr.head?.sha === head,
  '対象外のPR、またはテスト後に更新されたPRです');
  requireCondition(/^[a-f0-9]{40}$/.test(base)
    && pr.base.sha === base && commit.sha === head
    && commit.parents?.length === 1 && commit.parents[0].sha === base,
  'テスト済みのHEADが現在のmainを唯一の親に持っていません');
  requireCondition(Array.isArray(rules) && rules.some((rule) =>
    rule.type === 'required_status_checks'
      && rule.parameters?.strict_required_status_checks_policy === true
      && rule.parameters.required_status_checks?.some((check) =>
        check.context === 'typecheck-build' && check.integration_id === 15368)),
  'mainにGitHub Actionsのtypecheck-buildを必須とするstrict rulesetがありません');
}

export function checkDependencies({ files, previousManifest, nextManifest, previousLock, nextLock }) {
  requireCondition(files.length === 2
    && files.every((file) => file.status === 'modified' && Number.isInteger(file.changes) && file.changes > 0)
    && isDeepStrictEqual(files.map((file) => file.filename).sort(), expectedFiles),
  '変更対象は package.json と package-lock.json のみです');
  const before = previousManifest.devDependencies;
  const after = nextManifest.devDependencies;
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((name) => before[name] !== after[name]);
  const [name] = changed;
  requireCondition(changed.length === 1 && (leafPackages.has(name) || graphTools.has(name)), '許可した開発依存1件のみが対象です');

  const exactStable = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
  const oldVersion = typeof before[name] === 'string' && exactStable.exec(before[name]);
  const newVersion = typeof after[name] === 'string' && exactStable.exec(after[name]);
  requireCondition(oldVersion && newVersion && Number(oldVersion[1]) > 0
    && oldVersion[1] === newVersion[1]
    && (Number(newVersion[2]) > Number(oldVersion[2])
      || (newVersion[2] === oldVersion[2] && Number(newVersion[3]) > Number(oldVersion[3]))),
  '安定版の固定バージョンを同一メジャー内で上げる場合のみ対象です');
  requireCondition(isDeepStrictEqual(nextManifest,
    { ...previousManifest, devDependencies: { ...before, [name]: after[name] } }),
  'マニフェストに対象以外の変更があります');

  const key = `node_modules/${name}`;
  const oldEntry = previousLock.packages?.[key];
  const newEntry = nextLock.packages?.[key];
  const root = previousLock.packages?.[''];
  requireCondition(previousLock.lockfileVersion === 3 && oldEntry?.version === before[name]
    && root?.devDependencies?.[name] === before[name] && newEntry
    && newEntry.version === after[name]
    && newEntry.resolved === `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${after[name]}.tgz`
    && typeof newEntry.integrity === 'string' && npmIntegrity.test(newEntry.integrity)
    && newEntry.integrity !== oldEntry.integrity
    && !newEntry.hasInstallScript && !newEntry.link,
  '新しいnpmロックエントリーを確認できません');
  const nextRoot = { ...root, devDependencies: { ...root.devDependencies, [name]: after[name] } };
  if (leafPackages.has(name)) {
    requireCondition(isDeepStrictEqual(nextLock, {
      ...previousLock,
      packages: {
        ...previousLock.packages,
        '': nextRoot,
        [key]: { ...oldEntry, version: newEntry.version, resolved: newEntry.resolved, integrity: newEntry.integrity },
      },
    }), `${name} のロックに対象外の変更があります`);
  } else {
    checkGraphToolLock({ key, root, nextRoot, previousLock, nextLock });
  }
  return { name, from: before[name], to: after[name] };
}

function changedPaths(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((path) => path !== '' && !isDeepStrictEqual(before[path], after[path]));
}

function resolvePackage(packages, from, name) {
  if (!npmName.test(name)) return undefined;
  for (let scope = from; scope; scope = parentOf(scope)) {
    const path = `${scope}/node_modules/${name}`;
    if (Object.hasOwn(packages, path)) return path;
  }
  const path = `node_modules/${name}`;
  if (Object.hasOwn(packages, path)) return path;
}

function reachable(packages, root, otherDirectPins) {
  const seen = new Set();
  const pending = [root];
  while (pending.length) {
    const path = pending.pop();
    if (seen.has(path) || otherDirectPins.has(path)) continue;
    seen.add(path);
    const entry = packages[path];
    requireCondition(entry && typeof entry === 'object', `ロックのエントリーが不正です: ${path}`);
    // npm では、重複して宣言された dependencies を optionalDependencies が上書きする。
    // peer の制約があるだけでは、そのパッケージをこの更新の対象にしない。
    const optional = entry.optionalDependencies ?? {};
    const edges = { ...entry.dependencies, ...optional };
    for (const [name, requested] of Object.entries(edges)) {
      const dep = resolvePackage(packages, path, name);
      const pin = typeof requested === 'string' && requested.trim().replace(/^=\s*/, '').replace(/^v/, '');
      // 子が別の親からすでに訪問済みでも、対象範囲内で完全一致に固定された依存の辺はすべて確認する。
      // プラットフォーム固有の optional なエントリーは無くてもよいが、あるなら一致しなければならない。
      if (pin && npmVersion.test(pin)) {
        requireCondition(dep ? packages[dep].version === pin : Object.hasOwn(optional, name),
          `ロックの固定依存が一致しません: ${path} -> ${name}@${pin} (解決: ${dep ? packages[dep].version : 'なし'})`);
      } else if (!dep) {
        requireCondition(Object.hasOwn(optional, name),
          `ロックの必須依存が見つかりません: ${path} -> ${name}`);
      }
      if (dep && !seen.has(dep)) pending.push(dep);
    }
  }
  return seen;
}

function checkGraphToolLock({ key, root, nextRoot, previousLock, nextLock }) {
  const before = previousLock.packages;
  const after = nextLock.packages;
  requireCondition(isDeepStrictEqual({ ...previousLock, packages: after }, nextLock)
    && isDeepStrictEqual(after[''], nextRoot)
    && Object.keys(before).length <= maxLockPackages && Object.keys(after).length <= maxLockPackages,
  'ロックのルートやメタデータが変わったか、検証対象が大きすぎます');

  const direct = new Set(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
    .flatMap((field) => Object.keys(root[field] ?? {}).map((dep) => `node_modules/${dep}`)));
  direct.delete(key);
  const oldReachable = reachable(before, key, direct);
  const newReachable = reachable(after, key, direct);
  // 共有ホイスティング先の変更や削除が、他の直接依存の固定ピンや必須依存を壊していないか確認する。
  for (const otherKey of direct) {
    if (Object.hasOwn(after, otherKey)) reachable(after, otherKey, new Set());
  }
  const changes = changedPaths(before, after);
  requireCondition(changes.length <= maxLockChanges, 'ロックの変更件数が多すぎます');
  // 既知のネイティブバイナリ導入パッケージが更新前から依存グラフに存在する場合のみ継続を許可する。
  const existingInstallScripts = new Set([...oldReachable]
    .filter((path) => before[path]?.hasInstallScript === true)
    .map((path) => nameOf(path))
    .filter((dep) => allowedExistingInstallScripts.has(dep)));

  for (const path of changes) {
    const dep = nameOf(path);
    const entry = after[path];
    requireCondition(path === key || (
      (!Object.hasOwn(before, path) || oldReachable.has(path))
      && (!Object.hasOwn(after, path) || newReachable.has(path))),
    `対象ツールの依存グラフ・許可範囲外の変更: ${path}`);
    if (!Object.hasOwn(after, path)) continue;
    requireCondition(entry && npmName.test(dep) && (!entry.name || entry.name === dep)
      && typeof entry.version === 'string' && npmVersion.test(entry.version)
      && entry.resolved === `https://registry.npmjs.org/${dep}/-/${dep.split('/').at(-1)}-${entry.version}.tgz`
      && typeof entry.integrity === 'string' && npmIntegrity.test(entry.integrity)
      && !entry.link && !entry.inBundle
      && (!entry.hasInstallScript || existingInstallScripts.has(dep)),
    `npmレジストリ外・不明なパッケージまたは新規のインストールスクリプト: ${path}`);
  }
}

async function runWithConcurrency(items, limit, worker) {
  const controller = new AbortController();
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !controller.signal.aborted) {
      const index = next;
      next += 1;
      try {
        await worker(items[index], controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) controller.abort(error);
        throw error;
      }
    }
  });
  await Promise.all(workers);
}

// checkDependencies が両方のロックファイルとその変更パスを受け入れた後にだけ呼ぶ。
export async function checkRegistry({ change, previousLock, nextLock }, fetchMetadata = fetch, {
  concurrency = registryConcurrency,
  timeoutMs = registryTimeoutMs,
} = {}) {
  if (leafPackages.has(change.name)) return;
  const before = previousLock.packages;
  const after = nextLock.packages;
  const entries = new Map();
  for (const path of changedPaths(before, after)) {
    if (!Object.hasOwn(after, path)) continue;
    const name = nameOf(path);
    const entry = after[path];
    const id = `${name}@${entry.version}`;
    const item = entries.get(id) ?? { name, version: entry.version, entries: [] };
    item.entries.push(entry);
    entries.set(id, item);
  }

  await runWithConcurrency([...entries.values()], concurrency, async ({ name, version, entries: locked }, abortSignal) => {
    const response = await fetchMetadata(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
      { redirect: 'error', signal: AbortSignal.any([abortSignal, AbortSignal.timeout(timeoutMs)]) });
    requireCondition(response.ok === true, `npmで確認できないバージョン: ${name}@${version}`);
    const published = await response.json();
    const publishedInstall = ['preinstall', 'install', 'postinstall'].some((key) => Boolean(published.scripts?.[key]))
      || published.gypfile === true || published.hasInstallScript === true;
    const hasBundledDependencies = ['bundleDependencies', 'bundledDependencies'].some((field) => {
      const value = published[field];
      return Boolean(value) && (!Array.isArray(value) || value.length > 0);
    });
    for (const entry of locked) {
      requireCondition(published.name === name && published.version === version
        && published.dist?.tarball === entry.resolved && published.dist?.integrity === entry.integrity
        && Boolean(entry.hasInstallScript) === publishedInstall
        && !hasBundledDependencies
        && dependencyFields.every((field) => isDeepStrictEqual(entry[field] ?? {}, published[field] ?? {})),
      `ロックと公開npmメタデータが一致しません: ${name}@${version}`);
    }
  });
}

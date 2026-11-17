import { isDeepStrictEqual } from 'node:util';

const workerTypes = '@cloudflare/workers-types';
const workerBinary = /^@cloudflare\/workerd-(?:darwin|linux|windows)-(?:64|arm64)$/;
const cloudflareRuntime = (name) => name === 'miniflare' || name === 'workerd' || workerBinary.test(name);
const buildTools = new Map([
  ['vite', (name) => name === 'rolldown' || name === '@oxc-project/types'
    || name === '@rolldown/pluginutils' || /^@rolldown\/binding-[a-z0-9-]+$/.test(name)],
  ['wrangler', cloudflareRuntime],
  ['@cloudflare/vite-plugin', (name) => name === 'wrangler' || cloudflareRuntime(name)],
]);
const expectedFiles = ['package-lock.json', 'package.json'];

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
  requireCondition((changed.length === 1 && (name === workerTypes || buildTools.has(name))), '許可した開発依存1件のみが対象です');

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
    && typeof newEntry.integrity === 'string' && /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(newEntry.integrity)
    && newEntry.integrity !== oldEntry.integrity
    && !newEntry.hasInstallScript && !newEntry.link,
  '新しいnpmロックエントリーを確認できません');
  const nextRoot = { ...root, devDependencies: { ...root.devDependencies, [name]: after[name] } };
  if (name === workerTypes) {
    requireCondition(isDeepStrictEqual(nextLock, {
      ...previousLock,
      packages: {
        ...previousLock.packages,
        '': nextRoot,
        [key]: { ...oldEntry, version: newEntry.version, resolved: newEntry.resolved, integrity: newEntry.integrity },
      },
    }), 'workers-types のロックに対象外の変更があります');
  } else {
    checkBuildToolLock({ name, key, root, nextRoot, previousLock, nextLock });
  }
  return { name, from: before[name], to: after[name] };
}

const nameOf = (path) => path.split('/node_modules/').at(-1).replace(/^node_modules\//, '');
const parentOf = (path) => path.includes('/node_modules/') ? path.slice(0, path.lastIndexOf('/node_modules/')) : '';
const npmName = /^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/;
const npmVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const npmIntegrity = /^sha512-[A-Za-z0-9+/]{86}==$/;
const dependencyFields = ['dependencies', 'optionalDependencies', 'peerDependencies', 'peerDependenciesMeta'];

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
    // A peer constraint does not make that package part of this update.
    for (const name of new Set([...Object.keys(entry.dependencies ?? {}), ...Object.keys(entry.optionalDependencies ?? {})])) {
      const dep = resolvePackage(packages, path, name);
      if (dep && !seen.has(dep)) pending.push(dep);
    }
  }
  return seen;
}

function checkBuildToolLock({ name, key, root, nextRoot, previousLock, nextLock }) {
  const before = previousLock.packages;
  const after = nextLock.packages;
  requireCondition(isDeepStrictEqual({ ...previousLock, packages: after }, nextLock)
    && isDeepStrictEqual(after[''], nextRoot)
    && Object.keys(before).length <= 2000 && Object.keys(after).length <= 2000,
  'ロックのルートやメタデータが変わったか、検証対象が大きすぎます');

  const direct = new Set(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
    .flatMap((field) => Object.keys(root[field] ?? {}).map((dep) => `node_modules/${dep}`)));
  direct.delete(key);
  const oldReachable = reachable(before, key, direct);
  const newReachable = reachable(after, key, direct);
  const changes = changedPaths(before, after);
  requireCondition(changes.length <= 40, 'ロックの変更件数が多すぎます');
  const hadWorkerdInstall = [...oldReachable].some((path) => nameOf(path) === 'workerd'
    && before[path].hasInstallScript === true);

  for (const path of changes) {
    const dep = nameOf(path);
    const entry = after[path];
    requireCondition(path === key || (buildTools.get(name)(dep)
      && (!Object.hasOwn(before, path) || oldReachable.has(path))
      && (!Object.hasOwn(after, path) || newReachable.has(path))),
    `対象ツールの依存グラフ・許可範囲外の変更: ${path}`);
    if (!Object.hasOwn(after, path)) continue;
    requireCondition(entry && npmName.test(dep) && (!entry.name || entry.name === dep)
      && typeof entry.version === 'string' && npmVersion.test(entry.version)
      && entry.resolved === `https://registry.npmjs.org/${dep}/-/${dep.split('/').at(-1)}-${entry.version}.tgz`
      && typeof entry.integrity === 'string' && npmIntegrity.test(entry.integrity)
      && !entry.link && !entry.inBundle
      && (!entry.hasInstallScript || (dep === 'workerd' && hadWorkerdInstall)),
    `npmレジストリ外・不明なパッケージまたは新規のインストールスクリプト: ${path}`);
  }
}

// Only call after checkDependencies has accepted both lockfiles and their changed paths.
export async function checkRegistry({ change, previousLock, nextLock }, fetchMetadata = fetch) {
  if (change.name === workerTypes) return;
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

  await Promise.all([...entries.values()].map(async ({ name, version, entries: locked }) => {
    const response = await fetchMetadata(`https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
      { redirect: 'error', signal: AbortSignal.timeout(8000) });
    requireCondition(response.ok === true, `npmで確認できないバージョン: ${name}@${version}`);
    const published = await response.json();
    for (const entry of locked) {
      const publishedInstall = ['preinstall', 'install', 'postinstall'].some((key) => Boolean(published.scripts?.[key]));
      requireCondition(published.name === name && published.version === version
        && published.dist?.tarball === entry.resolved && published.dist?.integrity === entry.integrity
        && Boolean(entry.hasInstallScript) === publishedInstall
        && dependencyFields.every((field) => isDeepStrictEqual(entry[field] ?? {}, published[field] ?? {})),
      `ロックと公開npmメタデータが一致しません: ${name}@${version}`);
    }
  }));
}

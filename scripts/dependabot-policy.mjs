import { isDeepStrictEqual } from 'node:util';

const allowlist = new Set(['vite', '@cloudflare/workers-types']);
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
  requireCondition(changed.length === 1 && allowlist.has(name), '許可した開発依存1件のみが対象です');

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
  requireCondition(isDeepStrictEqual(nextLock, {
    ...previousLock,
    packages: {
      ...previousLock.packages,
      '': { ...root, devDependencies: { ...root.devDependencies, [name]: after[name] } },
      [key]: { ...oldEntry, version: newEntry.version, resolved: newEntry.resolved, integrity: newEntry.integrity },
    },
  }), 'ロックに対象外の変更があります（推移依存やメタデータの変更は手動レビュー）');
  return { name, from: before[name], to: after[name] };
}

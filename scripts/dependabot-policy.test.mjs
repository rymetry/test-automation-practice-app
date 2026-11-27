import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkDependencies, checkRegistry, checkRun } from './dependabot-policy.mjs';
import { formatSummaryCode, main } from './merge-dependabot.mjs';

function runFixture() {
  const repo = 'rymetry/test-automation-practice-app';
  const base = 'a'.repeat(40);
  const head = 'b'.repeat(40);
  const bot = { login: 'dependabot[bot]', type: 'Bot' };
  return {
    repo, base,
    run: {
      event: 'pull_request', conclusion: 'success', path: '.github/workflows/pr-ci.yml',
      actor: bot, head_repository: { full_name: repo }, head_sha: head,
      pull_requests: [{ number: 7 }],
    },
    pr: {
      number: 7, state: 'open', draft: false, user: bot,
      base: { repo: { full_name: repo }, ref: 'main', sha: base },
      head: { repo: { full_name: repo }, sha: head },
    },
    commit: { sha: head, parents: [{ sha: base }] },
    rules: [{
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: true,
        required_status_checks: [{ context: 'typecheck-build', integration_id: 15368 }],
      },
    }],
  };
}
test('allows only verified Dependabot run with fresh main and strict check', () => {
  assert.doesNotThrow(() => checkRun(runFixture()));
});
const runRejected = 'PR CI の実行元または紐づけを確認できません';
const prRejected = '対象外のPR、またはテスト後に更新されたPRです';
const baseRejected = 'テスト済みのHEADが現在のmainを唯一の親に持っていません';
const rulesRejected = 'mainにGitHub Actionsのtypecheck-buildを必須とするstrict rulesetがありません';
// run.actor と pr.user は同じオブジェクトなので、片方だけ変えるときは置き換える。
for (const [name, mutate, message] of [
  ['CI failure', (f) => { f.run.conclusion = 'failure'; }, runRejected],
  ['another workflow', (f) => { f.run.path = '.github/workflows/deploy.yml'; }, runRejected],
  ['non-PR workflow', (f) => { f.run.event = 'workflow_dispatch'; }, runRejected],
  ['different actor', (f) => { f.run.actor = { ...f.run.actor, login: 'someone' }; }, runRejected],
  ['run from another head repository', (f) => { f.run.head_repository = { full_name: 'someone/fork' }; }, runRejected],
  ['missing association', (f) => { f.run.pull_requests = []; }, runRejected],
  ['ambiguous association', (f) => { f.run.pull_requests.push({ number: 8 }); }, runRejected],
  ['wrong associated PR', (f) => { f.run.pull_requests[0].number = 77; }, runRejected],
  ['fork', (f) => { f.pr.head.repo.full_name = 'someone/fork'; }, prRejected],
  ['PR by another login', (f) => { f.pr.user = { ...f.pr.user, login: 'someone' }; }, prRejected],
  ['PR by a non-Bot user type', (f) => { f.pr.user = { ...f.pr.user, type: 'User' }; }, prRejected],
  ['PR into another repository', (f) => { f.pr.base.repo = { full_name: 'someone/other' }; }, prRejected],
  ['draft', (f) => { f.pr.draft = true; }, prRejected],
  ['closed', (f) => { f.pr.state = 'closed'; }, prRejected],
  ['different base branch', (f) => { f.pr.base.ref = 'release'; }, prRejected],
  ['stale HEAD', (f) => { f.pr.head.sha = 'c'.repeat(40); }, prRejected],
  ['stale PR base sha', (f) => { f.pr.base.sha = 'c'.repeat(40); }, baseRejected],
  ['different tested commit', (f) => { f.commit.sha = 'c'.repeat(40); }, baseRejected],
  ['stale base', (f) => { f.base = 'c'.repeat(40); f.pr.base.sha = f.base; }, baseRejected],
  ['nonlinear HEAD', (f) => { f.commit.parents.push({ sha: 'c'.repeat(40) }); }, baseRejected],
  ['missing protection', (f) => { f.rules = []; }, rulesRejected],
  ['non-status-check rule', (f) => { f.rules[0].type = 'pull_request'; }, rulesRejected],
  ['non-strict protection', (f) => { f.rules[0].parameters.strict_required_status_checks_policy = false; }, rulesRejected],
  ['different required check', (f) => { f.rules[0].parameters.required_status_checks[0].context = 'lint'; }, rulesRejected],
  ['no Actions pin', (f) => { delete f.rules[0].parameters.required_status_checks[0].integration_id; }, rulesRejected],
]) {
  test(`rejects ${name}`, () => {
    const fixture = runFixture();
    mutate(fixture);
    assert.throws(() => checkRun(fixture), { message });
  });
}

function integrity(value) {
  return 'sha512-' + Buffer.alloc(64, value).toString('base64');
}

function updateFixture({ name = 'vite', from = '8.3.5', to = '8.3.6' } = {}) {
  const files = ['package.json', 'package-lock.json'].map((filename) => ({ filename, status: 'modified', changes: 2 }));
  const manifest = (version) => ({ scripts: { build: 'vite build' }, devDependencies: { wrangler: '4.155.0', [name]: version } });
  const entry = (version, integrity) => ({
    version, resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`, integrity, dev: true,
  });
  const lock = (version, integrity) => ({
    lockfileVersion: 3,
    packages: { '': { devDependencies: manifest(version).devDependencies }, [`node_modules/${name}`]: entry(version, integrity) },
  });
  return {
    files, previousManifest: manifest(from), nextManifest: manifest(to),
    previousLock: lock(from, integrity('before')), nextLock: lock(to, integrity('after')),
  };
}

test('allows only one pinned, ordinary patch or minor across all allowlisted devDependencies', () => {
  assert.deepEqual(checkDependencies(updateFixture()), { name: 'vite', from: '8.3.5', to: '8.3.6' });
  assert.deepEqual(checkDependencies(updateFixture({
    name: '@cloudflare/workers-types', from: '5.20261029.1', to: '5.20261109.1',
  })), { name: '@cloudflare/workers-types', from: '5.20261029.1', to: '5.20261109.1' });
  assert.deepEqual(checkDependencies(updateFixture({
    name: '@fontsource/ibm-plex-sans', from: '5.3.0', to: '5.3.1',
  })), { name: '@fontsource/ibm-plex-sans', from: '5.3.0', to: '5.3.1' });
  assert.deepEqual(checkDependencies(updateFixture({
    name: 'typescript', from: '7.0.2', to: '7.0.3',
  })), { name: 'typescript', from: '7.0.2', to: '7.0.3' });
});
const versionRejected = '安定版の固定バージョンを同一メジャー内で上げる場合のみ対象です';
for (const [name, versions, message] of [
  ['major', { to: '9.0.0' }, versionRejected],
  ['downgrade', { to: '8.3.4' }, versionRejected],
  ['minor downgrade with higher patch', { to: '8.2.9' }, versionRejected],
  ['prerelease', { to: '8.3.6-dev' }, versionRejected],
  ['range', { to: '^8.3.6' }, versionRejected],
  ['0.x minor', { from: '0.1.0', to: '0.2.0' }, versionRejected],
  ['unlisted dependency', { name: 'eslint', from: '9.0.1', to: '9.0.2' }, '許可した開発依存1件のみが対象です'],
]) {
  test(`rejects ${name}`, () => assert.throws(() => checkDependencies(updateFixture(versions)), { message }));
}
for (const [name, mutate] of Object.entries({
  'extra file': (f) => { f.files.push({ filename: '.github/workflows/deploy.yml', status: 'modified', changes: 1 }); },
  'rename': (f) => { f.files[0].status = 'renamed'; },
  'second direct dependency': (f) => { f.nextManifest.devDependencies.wrangler = '4.156.0'; },
  'modified scripts': (f) => { f.nextManifest.scripts.build = 'node unrelated.mjs'; },
  'transitive lock change': (f) => { f.nextLock.packages['node_modules/unrelated'] = { version: '1.0.0' }; },
  'unapproved registry': (f) => { f.nextLock.packages['node_modules/vite'].resolved = 'https://example.com/vite.tgz'; },
  'install script': (f) => { f.nextLock.packages['node_modules/vite'].hasInstallScript = true; },
})) {
  test(`rejects ${name}`, () => {
    const fixture = updateFixture();
    mutate(fixture);
    assert.throws(() => checkDependencies(fixture));
  });
}

function packageEntry(name, version, fields = {}) {
  return {
    version,
    resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`,
    integrity: integrity(version),
    ...fields,
  };
}

function viteWithRolldown() {
  const fixture = updateFixture();
  for (const [lock, version] of [[fixture.previousLock, '1.2.15'], [fixture.nextLock, '1.2.16']]) {
    lock.packages['node_modules/vite'].dependencies = { rolldown: version };
    lock.packages['node_modules/rolldown'] = packageEntry('rolldown', version, {
      optionalDependencies: { '@rolldown/binding-linux-x64-gnu': version },
    });
    lock.packages['node_modules/@rolldown/binding-linux-x64-gnu'] = packageEntry('@rolldown/binding-linux-x64-gnu', version);
  }
  return fixture;
}

test('allows Vite Rolldown update including new reachable wasm runtime transitive dependencies', () => {
  const fixture = viteWithRolldown();
  fixture.nextLock.packages['node_modules/rolldown'].optionalDependencies['@rolldown/binding-wasm32-wasi'] = '1.2.16';
  fixture.nextLock.packages['node_modules/@rolldown/binding-wasm32-wasi'] = packageEntry('@rolldown/binding-wasm32-wasi', '1.2.16', {
    dependencies: { '@emnapi/core': '^1.7.0', '@napi-rs/wasm-runtime': '^1.1.0' },
  });
  fixture.nextLock.packages['node_modules/@emnapi/core'] = packageEntry('@emnapi/core', '1.7.1');
  fixture.nextLock.packages['node_modules/@napi-rs/wasm-runtime'] = packageEntry('@napi-rs/wasm-runtime', '1.1.1');
  assert.deepEqual(checkDependencies(fixture), { name: 'vite', from: '8.3.5', to: '8.3.6' });
});

test('allows Wrangler update adding new reachable transitive packages while blocking unreachable edits', () => {
  const fixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
  fixture.nextLock.packages['node_modules/wrangler'].dependencies = {
    '@cloudflare/workers-utils': '0.57.0',
    cloudflare: '5.2.0',
  };
  fixture.nextLock.packages['node_modules/@cloudflare/workers-utils'] = packageEntry('@cloudflare/workers-utils', '0.57.0', {
    dependencies: { undici: '7.30.2' },
  });
  fixture.nextLock.packages['node_modules/@cloudflare/workers-utils/node_modules/undici'] = packageEntry('undici', '7.30.2');
  fixture.nextLock.packages['node_modules/cloudflare'] = packageEntry('cloudflare', '5.2.0');
  assert.deepEqual(checkDependencies(fixture), { name: 'wrangler', from: '4.162.0', to: '4.167.0' });

  fixture.nextLock.packages['node_modules/stray-pkg'] = packageEntry('stray-pkg', '1.0.0');
  assert.throws(() => checkDependencies(fixture), /許可範囲外.*stray-pkg/);
});

test('allows TypeScript update with exact-pinned optional platform binaries', () => {
  const fixture = updateFixture({ name: 'typescript', from: '7.0.2', to: '7.0.3' });
  const targets = [
    'darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64',
  ];
  for (const [lock, version] of [[fixture.previousLock, '7.0.2'], [fixture.nextLock, '7.0.3']]) {
    const optionalDependencies = {};
    for (const target of targets) {
      const pkg = `@typescript/typescript-${target}`;
      optionalDependencies[pkg] = version;
      lock.packages[`node_modules/${pkg}`] = packageEntry(pkg, version);
    }
    lock.packages['node_modules/typescript'].optionalDependencies = optionalDependencies;
  }
  assert.deepEqual(checkDependencies(fixture), { name: 'typescript', from: '7.0.2', to: '7.0.3' });

  fixture.nextLock.packages['node_modules/@typescript/typescript-linux-x64'] = packageEntry('@typescript/typescript-linux-x64', '7.0.2');
  assert.throws(() => checkDependencies(fixture), /固定依存が一致しません.*typescript-linux-x64/);
});

test('supports nested Wrangler without granting permission to update the separately pinned Wrangler', () => {
  const name = '@cloudflare/vite-plugin';
  const fixture = updateFixture({ name, from: '1.66.0', to: '1.69.1' });
  for (const [lock, wrangler, workerd] of [[fixture.previousLock, '4.154.0', '1.20261023.1'], [fixture.nextLock, '4.160.0', '1.20261110.1']]) {
    lock.packages['node_modules/wrangler'] = packageEntry('wrangler', '4.155.0');
    lock.packages[`node_modules/${name}`].dependencies = { wrangler };
    lock.packages[`node_modules/${name}/node_modules/wrangler`] = packageEntry('wrangler', wrangler, {
      dependencies: { workerd },
    });
    lock.packages['node_modules/workerd'] = packageEntry('workerd', workerd, { hasInstallScript: true });
  }
  assert.equal(checkDependencies(fixture).name, name);
  fixture.nextLock.packages['node_modules/wrangler'] = packageEntry('wrangler', '4.162.0');
  assert.throws(() => checkDependencies(fixture), /許可範囲外/);
});

test('does not traverse into a hoisted direct dependency that the updated tool requests by range', () => {
  const name = '@cloudflare/vite-plugin';
  const fixture = updateFixture({ name, from: '1.66.0', to: '1.69.1' });
  for (const lock of [fixture.previousLock, fixture.nextLock]) {
    lock.packages['node_modules/wrangler'] = packageEntry('wrangler', '4.155.0');
    lock.packages[`node_modules/${name}`].dependencies = { wrangler: '^4.0.0' };
  }
  assert.deepEqual(checkDependencies(fixture), { name, from: '1.66.0', to: '1.69.1' });
  fixture.nextLock.packages['node_modules/wrangler'] = packageEntry('wrangler', '4.162.0');
  assert.throws(() => checkDependencies(fixture), /許可範囲外.*node_modules\/wrangler/);
});

test('treats root dependencies, not only devDependencies, as separately pinned direct dependencies', () => {
  const fixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
  for (const lock of [fixture.previousLock, fixture.nextLock]) {
    lock.packages[''].dependencies = { 'shared-runtime': '1.0.0' };
    lock.packages['node_modules/wrangler'].dependencies = { 'shared-runtime': '^1.0.0' };
    lock.packages['node_modules/shared-runtime'] = packageEntry('shared-runtime', '1.0.0');
  }
  assert.deepEqual(checkDependencies(fixture), { name: 'wrangler', from: '4.162.0', to: '4.167.0' });
  fixture.nextLock.packages['node_modules/shared-runtime'] = packageEntry('shared-runtime', '1.1.0');
  assert.throws(() => checkDependencies(fixture), /許可範囲外.*node_modules\/shared-runtime/);
});

test('allows pre-existing allowlisted install scripts (workerd, esbuild, fsevents) and rejects new or unlisted scripts', () => {
  for (const [pkg, fromVer, toVer] of [
    ['workerd', '1.20261023.1', '1.20261113.1'],
    ['esbuild', '0.28.2', '0.28.3'],
    ['fsevents', '2.3.3', '2.3.4'],
  ]) {
    const fixture = updateFixture({ name: 'wrangler', from: '4.155.0', to: '4.162.0' });
    fixture.previousLock.packages['node_modules/wrangler'].dependencies = { [pkg]: fromVer };
    fixture.previousLock.packages[`node_modules/${pkg}`] = packageEntry(pkg, fromVer, { hasInstallScript: true });
    fixture.nextLock.packages['node_modules/wrangler'].dependencies = { [pkg]: toVer };
    fixture.nextLock.packages[`node_modules/${pkg}`] = fixture.previousLock.packages[`node_modules/${pkg}`];
    fixture.nextLock.packages[`node_modules/wrangler/node_modules/${pkg}`] = packageEntry(pkg, toVer, { hasInstallScript: true });
    assert.equal(checkDependencies(fixture).name, 'wrangler');

    // Reject if the package did not previously have hasInstallScript in oldReachable.
    const withoutScript = packageEntry(pkg, fromVer);
    fixture.previousLock.packages[`node_modules/${pkg}`] = withoutScript;
    fixture.nextLock.packages[`node_modules/${pkg}`] = withoutScript;
    assert.throws(() => checkDependencies(fixture), /インストールスクリプト/);

    // Reject if the package had hasInstallScript before, but was outside oldReachable.
    const withScript = packageEntry(pkg, fromVer, { hasInstallScript: true });
    fixture.previousLock.packages[`node_modules/${pkg}`] = withScript;
    fixture.nextLock.packages[`node_modules/${pkg}`] = withScript;
    fixture.previousLock.packages['node_modules/wrangler'] = {
      ...fixture.previousLock.packages['node_modules/wrangler'], dependencies: {},
    };
    assert.throws(() => checkDependencies(fixture), /インストールスクリプト/);
  }

  // Reject an unlisted package even if it previously had hasInstallScript.
  const unlistedScript = updateFixture({ name: 'wrangler', from: '4.155.0', to: '4.162.0' });
  unlistedScript.previousLock.packages['node_modules/wrangler'].dependencies = { 'native-helper': '1.0.0' };
  unlistedScript.previousLock.packages['node_modules/native-helper'] = packageEntry('native-helper', '1.0.0', { hasInstallScript: true });
  unlistedScript.nextLock.packages['node_modules/wrangler'].dependencies = { 'native-helper': '1.0.1' };
  unlistedScript.nextLock.packages['node_modules/native-helper'] = packageEntry('native-helper', '1.0.1', { hasInstallScript: true });
  assert.throws(() => checkDependencies(unlistedScript), /インストールスクリプト/);

  // Reject a newly added transitive package with hasInstallScript.
  const newlyAdded = updateFixture({ name: 'wrangler', from: '4.155.0', to: '4.162.0' });
  newlyAdded.nextLock.packages['node_modules/wrangler'].dependencies = { esbuild: '0.28.3' };
  newlyAdded.nextLock.packages['node_modules/esbuild'] = packageEntry('esbuild', '0.28.3', { hasInstallScript: true });
  assert.throws(() => checkDependencies(newlyAdded), /インストールスクリプト/);
});

test('enforces the 200 changed lockfile entries boundary (allows >40 and 200, rejects 201)', () => {
  function fixtureWithChanges(transitiveCount) {
    const fixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
    const deps = {};
    for (let i = 0; i < transitiveCount; i += 1) {
      const pkg = `helper-${i}`;
      deps[pkg] = '1.0.0';
      fixture.nextLock.packages[`node_modules/${pkg}`] = packageEntry(pkg, '1.0.0');
    }
    fixture.nextLock.packages['node_modules/wrangler'].dependencies = deps;
    return fixture;
  }
  // 1 direct + 55 transitive = 56 changes (PR #15 scale, >40)
  assert.equal(checkDependencies(fixtureWithChanges(55)).name, 'wrangler');
  // Exactly 200 changes (1 direct + 199 transitive)
  assert.equal(checkDependencies(fixtureWithChanges(199)).name, 'wrangler');
  // 201 changes exceeds the 200-entry limit
  assert.throws(() => checkDependencies(fixtureWithChanges(200)), /変更件数が多すぎます/);
});

test('rejects reachable entry if it is only a peer, or modifies a pre-existing package outside oldReachable', () => {
  const fixture = viteWithRolldown();
  for (const lock of [fixture.previousLock, fixture.nextLock]) {
    const vite = lock.packages['node_modules/vite'];
    vite.peerDependencies = vite.dependencies;
    delete vite.dependencies;
  }
  assert.throws(() => checkDependencies(fixture), /許可範囲外/);

  const crossGraph = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
  crossGraph.previousLock.packages['node_modules/other-only'] = packageEntry('other-only', '1.0.0');
  crossGraph.nextLock.packages['node_modules/wrangler'].dependencies = { 'other-only': '1.0.1' };
  crossGraph.nextLock.packages['node_modules/other-only'] = packageEntry('other-only', '1.0.1');
  assert.throws(() => checkDependencies(crossGraph), /許可範囲外.*other-only/);
});

test('rejects extra lockfile changes on leaf packages (workers-types and fontsource)', () => {
  for (const [name, from, to] of [
    ['@cloudflare/workers-types', '5.20261029.1', '5.20261109.1'],
    ['@fontsource/ibm-plex-sans', '5.3.0', '5.3.1'],
  ]) {
    const leaf = updateFixture({ name, from, to });
    leaf.nextLock.packages[`node_modules/${name}`].engines = { node: '>=20' };
    assert.throws(() => checkDependencies(leaf), /対象外の変更/);
  }
});

test('rejects a reachable entry with an external tarball or malformed integrity', () => {
  const fixture = viteWithRolldown();
  fixture.nextLock.packages['node_modules/rolldown'].resolved = 'https://example.com/rolldown.tgz';
  assert.throws(() => checkDependencies(fixture), /レジストリ外/);
  fixture.nextLock.packages['node_modules/rolldown'] = packageEntry('rolldown', '1.2.16', { integrity: 'sha512-YQ==' });
  assert.throws(() => checkDependencies(fixture), /レジストリ外/);
});

function mockNpm(fixture) {
  return async (url, options) => {
    const [, pkg, version] = new URL(url).pathname.split('/').map(decodeURIComponent);
    const entry = fixture.nextLock.packages[`node_modules/${pkg}`];
    assert.equal(new URL(url).origin, 'https://registry.npmjs.org');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return { ok: true, json: async () => ({
      ...entry, name: pkg, version, dist: { integrity: entry.integrity, tarball: entry.resolved },
    }) };
  };
}

test('checks exact registry versions, integrity, forged dependencies, and skips leaf packages', async () => {
  const fixture = viteWithRolldown();
  const change = checkDependencies(fixture);
  const npm = mockNpm(fixture);
  await checkRegistry({ ...fixture, change }, npm);
  await assert.rejects(() => checkRegistry({ ...fixture, change }, async (url, options) => {
    const response = await npm(url, options);
    const published = await response.json();
    return { ok: true, json: async () => ({ ...published, dependencies: { forged: '1.0.0' } }) };
  }), /一致しません/);
  await assert.rejects(() => checkRegistry({ ...fixture, change }, async (url, options) => {
    const response = await npm(url, options);
    const published = await response.json();
    return { ok: true, json: async () => ({ ...published, scripts: { postinstall: 'echo pwn' } }) };
  }), /一致しません/);
  await assert.rejects(() => checkRegistry({ ...fixture, change }, async () => ({ ok: false })),
    /確認できない/);

  let leafCalls = 0;
  for (const [name, from, to] of [
    ['@cloudflare/workers-types', '5.20261029.1', '5.20261109.1'],
    ['@fontsource/ibm-plex-sans', '5.3.0', '5.3.1'],
  ]) {
    const leaf = updateFixture({ name, from, to });
    const leafChange = checkDependencies(leaf);
    await checkRegistry({ ...leaf, change: leafChange }, async () => {
      leafCalls += 1;
      throw new Error('leaf package should not fetch registry metadata');
    });
  }
  assert.equal(leafCalls, 0);
});

test('limits checkRegistry concurrency to 8 and enforces request timeout via AbortSignal', async () => {
  const fixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
  const deps = {};
  for (let i = 0; i < 11; i += 1) {
    const pkg = `sub-${i}`;
    deps[pkg] = '1.0.0';
    fixture.nextLock.packages[`node_modules/${pkg}`] = packageEntry(pkg, '1.0.0');
  }
  fixture.nextLock.packages['node_modules/wrangler'].dependencies = deps;
  const change = checkDependencies(fixture);

  const npm = mockNpm(fixture);
  let inFlight = 0;
  let maxInFlight = 0;
  let totalCalls = 0;
  await checkRegistry({ ...fixture, change }, async (url, options) => {
    inFlight += 1;
    totalCalls += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 15));
    try {
      return await npm(url, options);
    } finally {
      inFlight -= 1;
    }
  });
  assert.equal(totalCalls, 12);
  assert.equal(inFlight, 0);
  assert.equal(maxInFlight, 8);

  const singleFixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
  const singleChange = checkDependencies(singleFixture);
  let observedSignal = null;
  await assert.rejects(() => checkRegistry({ ...singleFixture, change: singleChange }, (_url, options) => {
    observedSignal = options.signal;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason ?? new Error('aborted')));
    });
  }, { timeoutMs: 25 }), /Timeout|abort/i);
  assert.equal(observedSignal?.aborted, true);
});

test('checks every exact incoming edge across the entire reachable graph, including optional deps for other OSes', () => {
  const fixture = viteWithRolldown();
  const binder = '@rolldown/binding-win32-x64-msvc';
  for (const [lock, version] of [[fixture.previousLock, '1.2.15'], [fixture.nextLock, '1.2.16']]) {
    lock.packages['node_modules/vite'].optionalDependencies = { [binder]: version };
    lock.packages['node_modules/rolldown'].optionalDependencies[binder] = version;
    lock.packages[`node_modules/${binder}`] = packageEntry(binder, version, { os: ['win32'], cpu: ['x64'] });
  }
  assert.equal(checkDependencies(fixture).name, 'vite');
  fixture.nextLock.packages['node_modules/rolldown'].optionalDependencies[binder] = '1.2.15';
  assert.throws(() => checkDependencies(fixture), /固定依存が一致しません.*binding-win32-x64-msvc/);

  // An optional dependency can legitimately be missing from a platform's lockfile.
  delete fixture.previousLock.packages[`node_modules/${binder}`];
  delete fixture.nextLock.packages[`node_modules/${binder}`];
  assert.equal(checkDependencies(fixture).name, 'vite');

  delete fixture.nextLock.packages['node_modules/rolldown'];
  assert.throws(() => checkDependencies(fixture), /固定依存が一致しません.*rolldown/);

  // Exact-pin mismatch on a non-family transitive package is also rejected.
  const wranglerFixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
  wranglerFixture.nextLock.packages['node_modules/wrangler'].dependencies = { '@cloudflare/workers-utils': '0.57.0' };
  wranglerFixture.nextLock.packages['node_modules/@cloudflare/workers-utils'] = packageEntry('@cloudflare/workers-utils', '0.57.0', {
    dependencies: { undici: '7.30.2' },
  });
  wranglerFixture.nextLock.packages['node_modules/undici'] = packageEntry('undici', '7.30.1');
  assert.throws(() => checkDependencies(wranglerFixture), /固定依存が一致しません.*undici@7\.30\.2/);
});

test('validates exact prerelease pins against the nearest nested package, not the hoisted package', () => {
  const fixture = updateFixture({ name: 'wrangler', from: '4.155.0', to: '4.162.0' });
  fixture.previousLock.packages['node_modules/wrangler'].dependencies = { miniflare: '5.0.0-beta.1' };
  fixture.nextLock.packages['node_modules/wrangler'].dependencies = { miniflare: '5.0.0-beta.2' };
  for (const lock of [fixture.previousLock, fixture.nextLock]) {
    lock.packages['node_modules/miniflare'] = packageEntry('miniflare', '5.0.0-beta.2');
  }
  fixture.previousLock.packages['node_modules/wrangler/node_modules/miniflare'] = packageEntry('miniflare', '5.0.0-beta.1');
  fixture.nextLock.packages['node_modules/wrangler/node_modules/miniflare'] = packageEntry('miniflare', '5.0.0-beta.2');
  assert.equal(checkDependencies(fixture).name, 'wrangler');
  fixture.nextLock.packages['node_modules/wrangler/node_modules/miniflare'] = packageEntry('miniflare', '5.0.0-beta.3');
  assert.throws(() => checkDependencies(fixture), /固定依存が一致しません.*miniflare/);
});

test('rejects mutating or deleting a shared hoisted dependency pinned or required by a sibling direct dependency', () => {
  function sharedHoistedFixture() {
    const fixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
    for (const manifest of [fixture.previousManifest, fixture.nextManifest]) {
      manifest.devDependencies['@cloudflare/vite-plugin'] = '1.70.1';
    }
    for (const lock of [fixture.previousLock, fixture.nextLock]) {
      lock.packages[''].devDependencies['@cloudflare/vite-plugin'] = '1.70.1';
      lock.packages['node_modules/@cloudflare/vite-plugin'] = packageEntry('@cloudflare/vite-plugin', '1.70.1', {
        dependencies: { wrangler: '4.162.0', unenv: '2.0.0-rc.24', 'shared-range': '^1.0.0' },
      });
      lock.packages['node_modules/@cloudflare/vite-plugin/node_modules/wrangler'] = packageEntry('wrangler', '4.162.0', {
        dependencies: { esbuild: '0.28.2' },
      });
      lock.packages['node_modules/esbuild'] = packageEntry('esbuild', '0.28.2', { hasInstallScript: true });
      lock.packages['node_modules/unenv'] = packageEntry('unenv', '2.0.0-rc.24');
      lock.packages['node_modules/shared-range'] = packageEntry('shared-range', '1.2.0');
      lock.packages['node_modules/wrangler'].dependencies = {
        esbuild: '0.28.2',
        unenv: '2.0.0-rc.24',
        'shared-range': '^1.0.0',
      };
    }
    return fixture;
  }

  // Positive pair: nesting the new version under wrangler preserves the sibling's hoisted exact pin.
  const nestedUpdate = sharedHoistedFixture();
  nestedUpdate.nextLock.packages['node_modules/wrangler'].dependencies.esbuild = '0.28.3';
  nestedUpdate.nextLock.packages['node_modules/wrangler/node_modules/esbuild'] = packageEntry('esbuild', '0.28.3', { hasInstallScript: true });
  assert.deepEqual(checkDependencies(nestedUpdate), { name: 'wrangler', from: '4.162.0', to: '4.167.0' });

  // Mutating hoisted esbuild in place violates @cloudflare/vite-plugin/node_modules/wrangler's exact pin.
  const mutatedHoisted = sharedHoistedFixture();
  mutatedHoisted.nextLock.packages['node_modules/wrangler'].dependencies.esbuild = '0.28.3';
  mutatedHoisted.nextLock.packages['node_modules/esbuild'] = packageEntry('esbuild', '0.28.3', { hasInstallScript: true });
  assert.throws(() => checkDependencies(mutatedHoisted), /固定依存が一致しません.*esbuild@0\.28\.2/);

  // Deleting hoisted exact-pinned unenv violates @cloudflare/vite-plugin's exact pin.
  const deletedExact = sharedHoistedFixture();
  delete deletedExact.nextLock.packages['node_modules/wrangler'].dependencies.unenv;
  delete deletedExact.nextLock.packages['node_modules/unenv'];
  assert.throws(() => checkDependencies(deletedExact), /固定依存が一致しません.*unenv@2\.0\.0-rc\.24/);

  // Deleting hoisted range-pinned shared-range breaks @cloudflare/vite-plugin's required dependency.
  const deletedRange = sharedHoistedFixture();
  delete deletedRange.nextLock.packages['node_modules/wrangler'].dependencies['shared-range'];
  delete deletedRange.nextLock.packages['node_modules/shared-range'];
  assert.throws(() => checkDependencies(deletedRange), /必須依存が見つかりません.*shared-range/);
});

test('aborts in-flight requests and stops dispatching queued packages immediately on first checkRegistry failure', async () => {
  const fixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
  const deps = {};
  for (let i = 0; i < 20; i += 1) {
    const pkg = `sub-${i}`;
    deps[pkg] = '1.0.0';
    fixture.nextLock.packages[`node_modules/${pkg}`] = packageEntry(pkg, '1.0.0');
  }
  fixture.nextLock.packages['node_modules/wrangler'].dependencies = deps;
  const change = checkDependencies(fixture);

  let totalCalls = 0;
  let callsAfterReject = 0;
  let rejected = false;
  const siblingSignals = [];

  await assert.rejects(() => checkRegistry({ ...fixture, change }, (_url, options) => {
    totalCalls += 1;
    if (rejected) callsAfterReject += 1;
    if (totalCalls === 1) {
      return Promise.resolve({ ok: false });
    }
    siblingSignals.push(options.signal);
    return new Promise((_resolve, reject) => {
      if (options.signal.aborted) {
        reject(options.signal.reason ?? new Error('aborted'));
        return;
      }
      options.signal.addEventListener('abort', () => reject(options.signal.reason ?? new Error('aborted')), { once: true });
    });
  }, { concurrency: 8, timeoutMs: 5000 }), /npmで確認できないバージョン/);
  rejected = true;

  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(callsAfterReject, 0);
  assert.ok(totalCalls <= 8, `expected at most 8 dispatched requests, got ${totalCalls}`);
  assert.ok(siblingSignals.length > 0);
  assert.ok(siblingSignals.every((signal) => signal.aborted), 'expected all in-flight sibling requests to be aborted');
});

test('enforces the 2000 lockfile packages boundary on both before and after lockfiles', () => {
  function fixtureWithLockSize(beforeTotal, afterTotal) {
    const fixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
    // '' and node_modules/wrangler already occupy 2 entries.
    const commonUnchanged = Math.min(beforeTotal, afterTotal) - 2;
    for (let i = 0; i < commonUnchanged; i += 1) {
      const entry = packageEntry(`pad-${i}`, '1.0.0');
      fixture.previousLock.packages[`node_modules/pad-${i}`] = entry;
      fixture.nextLock.packages[`node_modules/pad-${i}`] = entry;
    }
    if (afterTotal > beforeTotal) {
      const extra = afterTotal - beforeTotal;
      const deps = {};
      for (let i = 0; i < extra; i += 1) {
        const pkg = `added-${i}`;
        deps[pkg] = '1.0.0';
        fixture.nextLock.packages[`node_modules/${pkg}`] = packageEntry(pkg, '1.0.0');
      }
      fixture.nextLock.packages['node_modules/wrangler'].dependencies = deps;
    } else if (beforeTotal > afterTotal) {
      const extra = beforeTotal - afterTotal;
      const deps = {};
      for (let i = 0; i < extra; i += 1) {
        const pkg = `removed-${i}`;
        deps[pkg] = '1.0.0';
        fixture.previousLock.packages[`node_modules/${pkg}`] = packageEntry(pkg, '1.0.0');
      }
      fixture.previousLock.packages['node_modules/wrangler'].dependencies = deps;
    }
    assert.equal(Object.keys(fixture.previousLock.packages).length, beforeTotal);
    assert.equal(Object.keys(fixture.nextLock.packages).length, afterTotal);
    return fixture;
  }

  assert.equal(checkDependencies(fixtureWithLockSize(2000, 2000)).name, 'wrangler');
  assert.throws(() => checkDependencies(fixtureWithLockSize(2000, 2001)), /大きすぎます/);
  assert.throws(() => checkDependencies(fixtureWithLockSize(2001, 2000)), /大きすぎます/);
});

test('allows deleting oldReachable transitive entries, rejects unreachable deletions or dropped edits, and skips deleted paths in checkRegistry', async () => {
  const fixture = updateFixture({ name: 'wrangler', from: '4.162.0', to: '4.167.0' });
  fixture.previousLock.packages['node_modules/wrangler'].dependencies = { 'old-dep': '1.0.0' };
  fixture.previousLock.packages['node_modules/old-dep'] = packageEntry('old-dep', '1.0.0');
  fixture.previousLock.packages['node_modules/unrelated-existing'] = packageEntry('unrelated-existing', '1.0.0');
  fixture.nextLock.packages['node_modules/unrelated-existing'] = fixture.previousLock.packages['node_modules/unrelated-existing'];

  const change = checkDependencies(fixture);
  assert.deepEqual(change, { name: 'wrangler', from: '4.162.0', to: '4.167.0' });

  const fetched = [];
  const npm = mockNpm(fixture);
  await checkRegistry({ ...fixture, change }, async (url, options) => {
    const [, pkg, version] = new URL(url).pathname.split('/').map(decodeURIComponent);
    fetched.push(`${pkg}@${version}`);
    return npm(url, options);
  });
  assert.deepEqual(fetched, ['wrangler@4.167.0']);

  // Deleting an entry that was not in oldReachable is rejected.
  const unreachableDeletion = structuredClone(fixture);
  delete unreachableDeletion.nextLock.packages['node_modules/unrelated-existing'];
  assert.throws(() => checkDependencies(unreachableDeletion), /許可範囲外.*unrelated-existing/);

  // Modifying an oldReachable entry that is no longer in newReachable is rejected.
  const mutatedDropped = structuredClone(fixture);
  mutatedDropped.nextLock.packages['node_modules/old-dep'] = packageEntry('old-dep', '1.0.1');
  assert.throws(() => checkDependencies(mutatedDropped), /許可範囲外.*old-dep/);
});

test('rejects transitive entries with inBundle, link, or mismatched name while allowing matching name', () => {
  const validWithName = viteWithRolldown();
  validWithName.nextLock.packages['node_modules/rolldown'].name = 'rolldown';
  assert.equal(checkDependencies(validWithName).name, 'vite');

  for (const [label, mutate] of Object.entries({
    'mismatched name': (entry) => { entry.name = 'forged-pkg'; },
    inBundle: (entry) => { entry.inBundle = true; },
    link: (entry) => { entry.link = true; },
  })) {
    const fixture = viteWithRolldown();
    mutate(fixture.nextLock.packages['node_modules/rolldown']);
    assert.throws(() => checkDependencies(fixture), /npmレジストリ外/, `expected rejection for ${label}`);
  }
});

test('rejects top-level lockfile metadata or root entry tampering on graph tool updates', () => {
  for (const [label, mutate] of Object.entries({
    'top-level metadata': (f) => { f.nextLock.name = 'tampered'; },
    'root entry field': (f) => { f.nextLock.packages[''].license = 'MIT'; },
    'root devDependencies extra key': (f) => { f.nextLock.packages[''].devDependencies.extra = '1.0.0'; },
  })) {
    const fixture = viteWithRolldown();
    mutate(fixture);
    assert.throws(() => checkDependencies(fixture), /ルートやメタデータ/, `expected rejection for ${label}`);
  }
});

test('verifies every checkRegistry metadata field including dist, dependency fields, install scripts, gypfile, and bundled deps', async () => {
  const fixture = viteWithRolldown();
  fixture.nextLock.packages['node_modules/rolldown'].peerDependencies = { vite: '^8.0.0' };
  fixture.nextLock.packages['node_modules/rolldown'].peerDependenciesMeta = { vite: { optional: true } };
  const change = checkDependencies(fixture);
  const baseNpm = mockNpm(fixture);

  const withRolldownOverride = (mutatePublished) => async (url, options) => {
    const response = await baseNpm(url, options);
    const published = await response.json();
    if (published.name === 'rolldown') mutatePublished(published);
    return { ok: true, json: async () => published };
  };

  // Baseline passes with populated optionalDependencies, peerDependencies, and peerDependenciesMeta.
  await checkRegistry({ ...fixture, change }, baseNpm);

  // Empty or false bundleDependencies / bundledDependencies are permitted.
  for (const allowedBundle of [
    { bundleDependencies: [] },
    { bundledDependencies: [] },
    { bundleDependencies: false },
    { bundledDependencies: false },
  ]) {
    await checkRegistry({ ...fixture, change }, withRolldownOverride((published) => Object.assign(published, allowedBundle)));
  }

  for (const [label, mutatePublished] of Object.entries({
    'published name': (p) => { p.name = 'other'; },
    'published version': (p) => { p.version = '1.2.17'; },
    'dist tarball': (p) => { p.dist.tarball = 'https://registry.npmjs.org/rolldown/-/rolldown-1.2.17.tgz'; },
    'dist integrity': (p) => { p.dist.integrity = integrity('tampered'); },
    optionalDependencies: (p) => { p.optionalDependencies = { '@rolldown/binding-linux-x64-gnu': '9.9.9' }; },
    peerDependencies: (p) => { p.peerDependencies = { vite: '^7.0.0' }; },
    peerDependenciesMeta: (p) => { p.peerDependenciesMeta = { vite: { optional: false } }; },
    'unexpected preinstall script': (p) => { p.scripts = { preinstall: 'echo pwn' }; },
    'unexpected install script': (p) => { p.scripts = { install: 'echo pwn' }; },
    'unexpected gypfile': (p) => { p.gypfile = true; },
    'unexpected published hasInstallScript': (p) => { p.hasInstallScript = true; },
    'non-empty bundleDependencies': (p) => { p.bundleDependencies = ['bundled-a']; },
    'non-empty bundledDependencies': (p) => { p.bundledDependencies = ['bundled-b']; },
    'boolean true bundleDependencies': (p) => { p.bundleDependencies = true; },
    'boolean true bundledDependencies': (p) => { p.bundledDependencies = true; },
  })) {
    await assert.rejects(() => checkRegistry({ ...fixture, change }, withRolldownOverride(mutatePublished)),
      /一致しません/, `expected checkRegistry rejection for ${label}`);
  }

  // Verify hasInstallScript: true in lockfile must match published install indicator.
  const installFixture = updateFixture({ name: 'wrangler', from: '4.155.0', to: '4.162.0' });
  installFixture.previousLock.packages['node_modules/wrangler'].dependencies = { esbuild: '0.28.2' };
  installFixture.previousLock.packages['node_modules/esbuild'] = packageEntry('esbuild', '0.28.2', { hasInstallScript: true });
  installFixture.nextLock.packages['node_modules/wrangler'].dependencies = { esbuild: '0.28.3' };
  installFixture.nextLock.packages['node_modules/esbuild'] = packageEntry('esbuild', '0.28.3', { hasInstallScript: true });
  const installChange = checkDependencies(installFixture);

  const installNpm = (esbuildPublishedExtra) => async (url, options) => {
    const [, pkg, version] = new URL(url).pathname.split('/').map(decodeURIComponent);
    const entry = installFixture.nextLock.packages[`node_modules/${pkg}`];
    assert.ok(options.signal instanceof AbortSignal);
    const published = {
      name: pkg,
      version,
      dist: { integrity: entry.integrity, tarball: entry.resolved },
      dependencies: entry.dependencies,
      ...(pkg === 'esbuild' ? esbuildPublishedExtra : {}),
    };
    return { ok: true, json: async () => published };
  };

  for (const matchingIndicator of [
    { scripts: { postinstall: 'node install.js' } },
    { scripts: { install: 'node install.js' } },
    { scripts: { preinstall: 'node install.js' } },
    { gypfile: true },
    { hasInstallScript: true },
  ]) {
    await checkRegistry({ ...installFixture, change: installChange }, installNpm(matchingIndicator));
  }

  await assert.rejects(() => checkRegistry({ ...installFixture, change: installChange }, installNpm({ scripts: {} })),
    /一致しません/);
});

test('formatSummaryCode sanitizes newlines, HTML/Markdown, backticks, and empty errors into a single-line code span', () => {
  assert.equal(formatSummaryCode('単純な理由'), '`単純な理由`');
  assert.equal(formatSummaryCode('line1\nline2\r\nline3\tindent'), '`line1 line2 line3 indent`');
  assert.equal(formatSummaryCode('<script>alert(1)</script> [evil](https://example.test)'), '`<script>alert(1)</script> [evil](https://example.test)`');
  assert.equal(formatSummaryCode('path `node_modules/x` invalid'), '``path `node_modules/x` invalid``');
  assert.equal(formatSummaryCode('``wrapped``'), '``` ``wrapped`` ```');
  assert.equal(formatSummaryCode('`leading'), '`` `leading ``');
  assert.equal(formatSummaryCode('trailing`'), '`` trailing` ``');
  assert.equal(formatSummaryCode('  \n\t  '), '`不明なエラー`');
  assert.equal(formatSummaryCode(undefined), '`不明なエラー`');
});

// main() を偽の gh と npm で動かし、マージ要求を出したかどうかを観測する。
async function runMerge(t, mutate = () => {}) {
  const scenario = { ...runFixture(), ...updateFixture() };
  scenario.pr.changed_files = 2;
  scenario.mainShas = [scenario.base, scenario.base];
  scenario.fetchMetadata = mockNpm(scenario);
  mutate(scenario);
  const { repo, run, pr, base } = scenario;
  const head = run.head_sha;
  const mergeSha = 'd'.repeat(40);
  const dir = mkdtempSync(join(tmpdir(), 'merge-dependabot-'));
  const summaryPath = join(dir, 'summary.md');
  writeFileSync(join(dir, 'event.json'), JSON.stringify({ workflow_run: run }));
  const env = { GITHUB_EVENT_PATH: join(dir, 'event.json'), GITHUB_REPOSITORY: repo, GITHUB_STEP_SUMMARY: summaryPath };
  const savedEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  });
  Object.assign(process.env, env);
  const log = t.mock.method(console, 'log', () => {});

  const calls = [];
  let merged = false;
  const responses = {
    'git/ref/heads/main': () => ({ object: { sha: scenario.mainShas.shift() } }),
    [`pulls/${pr.number}`]: () => (merged ? scenario.mergedPr ?? { merged: true, head: { sha: head }, merge_commit_sha: mergeSha } : pr),
    [`commits/${head}`]: () => scenario.commit,
    'rules/branches/main?per_page=100': () => scenario.rules,
    [`pulls/${pr.number}/files?per_page=3`]: () => scenario.files,
    [`contents/package.json?ref=${base}`]: () => scenario.previousManifest,
    [`contents/package.json?ref=${head}`]: () => scenario.nextManifest,
    [`contents/package-lock.json?ref=${base}`]: () => scenario.previousLock,
    [`contents/package-lock.json?ref=${head}`]: () => scenario.nextLock,
    [`pulls/${pr.number}/merge`]: () => { merged = true; return scenario.mergeResult ?? { merged: true, sha: mergeSha }; },
  };
  const gh = (...args) => {
    calls.push(args);
    const respond = responses[args[1].slice(`repos/${repo}/`.length)];
    if (args[0] !== 'api' || !respond) throw new Error(`unexpected gh call: ${args.join(' ')}`);
    return JSON.stringify(respond());
  };
  await main({ gh, fetchMetadata: scenario.fetchMetadata });
  return {
    calls,
    logs: log.mock.calls.map((call) => call.arguments[0]),
    mergeCalls: calls.filter((args) => args[1] === `repos/${repo}/pulls/${pr.number}/merge`),
    summary: readFileSync(summaryPath, 'utf8'),
    head, mergeSha, repo,
  };
}

test('main merges a verified update with the tested head sha as the merge condition', async (t) => {
  const { logs, mergeCalls, summary, head, mergeSha, repo } = await runMerge(t);
  assert.deepEqual(logs, ['検証済み: vite 8.3.5 -> 8.3.6']);
  assert.deepEqual(mergeCalls, [[
    'api', `repos/${repo}/pulls/7/merge`, '--method', 'PUT', '-f', `sha=${head}`, '-f', 'merge_method=merge',
  ]]);
  assert.equal(summary, [
    '### Dependabot automerge: マージ完了 (PR #7)',
    '- 対象: `vite` `8.3.5` -> `8.3.6`',
    `- マージコミット: \`${mergeSha}\``,
    '',
  ].join('\n'));
});

for (const [name, mutate, reason] of [
  ['checkRun', (s) => { s.commit.parents.push({ sha: 'c'.repeat(40) }); },
    'テスト済みのHEADが現在のmainを唯一の親に持っていません'],
  ['changed file count', (s) => { s.pr.changed_files = 3; }, '変更対象はファイル2件のみです'],
  ['checkDependencies', (s) => {
    s.nextManifest.devDependencies.vite = '9.0.0';
  }, '安定版の固定バージョンを同一メジャー内で上げる場合のみ対象です'],
  ['checkRegistry', (s) => { s.fetchMetadata = async () => ({ ok: false }); }, 'npmで確認できないバージョン: vite@8.3.6'],
]) {
  test(`main does not request a merge when ${name} rejects the update`, async (t) => {
    const { logs, mergeCalls, summary } = await runMerge(t, mutate);
    assert.deepEqual(logs, [`自動マージせず手動レビュー: ${reason}`]);
    assert.deepEqual(mergeCalls, []);
    assert.equal(summary, `### Dependabot automerge: 手動レビュー (PR #7)\n- 理由: \`${reason}\`\n`);
  });
}

for (const [name, mutate] of [
  ['the run has no single linked PR', (s) => { s.run.pull_requests = []; }],
  ['the run head sha is malformed', (s) => { s.run.head_sha = 'not-a-sha'; }],
  ['the run is linked to two PRs', (s) => { s.run.pull_requests = [{ number: 7 }, { number: 8 }]; }],
]) {
  test(`main skips without calling GitHub when ${name}`, async (t) => {
    const { calls, logs, summary } = await runMerge(t, mutate);
    const reason = 'CI実行とPRを一意に紐づけられないため対象外です';
    assert.deepEqual(calls, []);
    assert.deepEqual(logs, [reason]);
    assert.equal(summary, `### Dependabot automerge: スキップ\n- 理由: ${reason}\n`);
  });
}

for (const [name, mutate, message] of [
  ['the merge API does not report merged', (s) => { s.mergeResult = { merged: false, sha: 'd'.repeat(40) }; },
    'GitHubがマージを受け付けませんでした'],
  ['the PR is not merged afterwards', (s) => { s.mergedPr = { merged: false, head: { sha: s.run.head_sha }, merge_commit_sha: 'd'.repeat(40) }; },
    'マージを確認できませんでした'],
  ['the merged head differs', (s) => { s.mergedPr = { merged: true, head: { sha: 'e'.repeat(40) }, merge_commit_sha: 'd'.repeat(40) }; },
    'マージを確認できませんでした'],
  ['the merge API returns a malformed sha', (s) => {
    s.mergeResult = { merged: true, sha: 'bad' };
    s.mergedPr = { merged: true, head: { sha: s.run.head_sha }, merge_commit_sha: 'bad' };
  }, 'マージを確認できませんでした'],
  ['the merge commit differs', (s) => { s.mergedPr = { merged: true, head: { sha: s.run.head_sha }, merge_commit_sha: 'e'.repeat(40) }; },
    'マージを確認できませんでした'],
]) {
  test(`main fails when ${name}`, async (t) => {
    await assert.rejects(() => runMerge(t, mutate), { message });
  });
}

test('main does not request a merge when main advanced after verification', async (t) => {
  const { logs, mergeCalls } = await runMerge(t, (s) => { s.mainShas = [s.base, 'c'.repeat(40)]; });
  assert.deepEqual(logs, ['検証済み: vite 8.3.5 -> 8.3.6', 'mainが進んだため、最新mainで再テストが必要です']);
  assert.deepEqual(mergeCalls, []);
});

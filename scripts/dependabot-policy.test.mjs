import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDependencies, checkRegistry, checkRun } from './dependabot-policy.mjs';

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
for (const [name, mutate] of Object.entries({
  'CI failure': (f) => { f.run.conclusion = 'failure'; },
  'another workflow': (f) => { f.run.path = '.github/workflows/deploy.yml'; },
  'non-PR workflow': (f) => { f.run.event = 'workflow_dispatch'; },
  'different actor': (f) => { f.run.actor = { login: 'someone' }; },
  'missing association': (f) => { f.run.pull_requests = []; },
  'ambiguous association': (f) => { f.run.pull_requests.push({ number: 8 }); },
  'wrong associated PR': (f) => { f.run.pull_requests[0].number = 77; },
  'fork': (f) => { f.pr.head.repo.full_name = 'someone/fork'; },
  'human PR': (f) => { f.pr.user = { login: 'someone', type: 'User' }; },
  'draft': (f) => { f.pr.draft = true; },
  'closed': (f) => { f.pr.state = 'closed'; },
  'different base branch': (f) => { f.pr.base.ref = 'release'; },
  'stale HEAD': (f) => { f.pr.head.sha = 'c'.repeat(40); },
  'stale base': (f) => { f.base = 'c'.repeat(40); f.pr.base.sha = f.base; },
  'nonlinear HEAD': (f) => { f.commit.parents.push({ sha: 'c'.repeat(40) }); },
  'missing protection': (f) => { f.rules = []; },
  'non-strict protection': (f) => { f.rules[0].parameters.strict_required_status_checks_policy = false; },
  'no Actions pin': (f) => { delete f.rules[0].parameters.required_status_checks[0].integration_id; },
})) {
  test(`rejects ${name}`, () => {
    const fixture = runFixture();
    mutate(fixture);
    assert.throws(() => checkRun(fixture));
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
for (const [name, versions] of Object.entries({
  major: { to: '9.0.0' },
  downgrade: { to: '8.3.4' },
  prerelease: { to: '8.3.6-dev' },
  range: { to: '^8.3.6' },
  '0.x minor': { from: '0.1.0', to: '0.2.0' },
  'unlisted dependency': { name: 'eslint', from: '9.0.1', to: '9.0.2' },
})) {
  test(`rejects ${name}`, () => assert.throws(() => checkDependencies(updateFixture(versions))));
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

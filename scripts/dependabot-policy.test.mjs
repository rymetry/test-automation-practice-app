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

test('allows only one pinned, ordinary patch or minor', () => {
  assert.deepEqual(checkDependencies(updateFixture()), { name: 'vite', from: '8.3.5', to: '8.3.6' });
  assert.deepEqual(checkDependencies(updateFixture({
    name: '@cloudflare/workers-types', from: '5.20261029.1', to: '5.20261109.1',
  })), { name: '@cloudflare/workers-types', from: '5.20261029.1', to: '5.20261109.1' });
});
for (const [name, versions] of Object.entries({
  major: { to: '9.0.0' },
  downgrade: { to: '8.3.4' },
  prerelease: { to: '8.3.6-dev' },
  range: { to: '^8.3.6' },
  '0.x minor': { from: '0.1.0', to: '0.2.0' },
  'unlisted dependency': { name: 'typescript', from: '7.0.1', to: '7.0.2' },
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

test('allows the Vite Rolldown update and its optional binding', () => {
  assert.equal(checkDependencies(viteWithRolldown()).name, 'vite');
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

test('allows the previously installed workerd script when npm puts it under Wrangler', () => {
  const fixture = updateFixture({ name: 'wrangler', from: '4.155.0', to: '4.162.0' });
  fixture.previousLock.packages['node_modules/wrangler'].dependencies = { workerd: '1.20261023.1' };
  fixture.previousLock.packages['node_modules/workerd'] = packageEntry('workerd', '1.20261023.1', { hasInstallScript: true });
  fixture.nextLock.packages['node_modules/wrangler'].dependencies = { workerd: '1.20261113.1' };
  fixture.nextLock.packages['node_modules/workerd'] = fixture.previousLock.packages['node_modules/workerd'];
  fixture.nextLock.packages['node_modules/wrangler/node_modules/workerd'] = packageEntry('workerd', '1.20261113.1', { hasInstallScript: true });
  assert.equal(checkDependencies(fixture).name, 'wrangler');
  fixture.previousLock.packages['node_modules/wrangler'] = {
    ...fixture.previousLock.packages['node_modules/wrangler'], dependencies: {},
  };
  assert.throws(() => checkDependencies(fixture), /インストールスクリプト/);
});

test('rejects in-family entry if it is only a peer, not a regular or optional dependency', () => {
  const fixture = viteWithRolldown();
  for (const lock of [fixture.previousLock, fixture.nextLock]) {
    const vite = lock.packages['node_modules/vite'];
    vite.peerDependencies = vite.dependencies;
    delete vite.dependencies;
  }
  assert.throws(() => checkDependencies(fixture), /許可範囲外/);
});

test('rejects unrelated reachable packages and workers-types transitive changes', () => {
  const fixture = viteWithRolldown();
  fixture.nextLock.packages['node_modules/rolldown'].dependencies = { unusual: '1.0.0' };
  fixture.nextLock.packages['node_modules/unusual'] = packageEntry('unusual', '1.0.0');
  assert.throws(() => checkDependencies(fixture), /許可範囲外/);
  const types = updateFixture({ name: '@cloudflare/workers-types', from: '5.20261029.1', to: '5.20261109.1' });
  types.nextLock.packages['node_modules/@cloudflare/workers-types'].engines = { node: '>=20' };
  assert.throws(() => checkDependencies(types), /対象外の変更/);
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
    return { ok: true, json: async () => ({
      ...entry, name: pkg, version, dist: { integrity: entry.integrity, tarball: entry.resolved },
    }) };
  };
}

test('checks exact registry versions, integrity and dependency metadata', async () => {
  const fixture = viteWithRolldown();
  const change = checkDependencies(fixture);
  const npm = mockNpm(fixture);
  await checkRegistry({ ...fixture, change }, npm);
  await assert.rejects(() => checkRegistry({ ...fixture, change }, async (url, options) => {
    const response = await npm(url, options);
    const published = await response.json();
    return { ok: true, json: async () => ({ ...published, dependencies: { forged: '1.0.0' } }) };
  }), /一致しません/);
  await assert.rejects(() => checkRegistry({ ...fixture, change }, async () => ({ ok: false })),
    /確認できない/);
});

test('checks every exact incoming edge, including an optional dependency for a different OS', () => {
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

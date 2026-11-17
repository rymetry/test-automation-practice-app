import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDependencies, checkRun } from './dependabot-policy.mjs';

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

function updateFixture({ name = 'vite', from = '8.3.5', to = '8.3.6' } = {}) {
  const files = ['package.json', 'package-lock.json'].map((filename) => ({ filename, status: 'modified', changes: 2 }));
  const manifest = (version) => ({ scripts: { build: 'vite build' }, devDependencies: { [name]: version, wrangler: '4.155.0' } });
  const entry = (version, integrity) => ({
    version, resolved: `https://registry.npmjs.org/${name}/-/${name.split('/').at(-1)}-${version}.tgz`, integrity, dev: true,
  });
  const lock = (version, integrity) => ({
    lockfileVersion: 3,
    packages: { '': { devDependencies: manifest(version).devDependencies }, [`node_modules/${name}`]: entry(version, integrity) },
  });
  return {
    files, previousManifest: manifest(from), nextManifest: manifest(to),
    previousLock: lock(from, 'sha512-QVRUcA=='), nextLock: lock(to, 'sha512-QVRUcg=='),
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
  'unlisted dependency': { name: '@cloudflare/vite-plugin', from: '1.66.0', to: '1.67.0' },
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

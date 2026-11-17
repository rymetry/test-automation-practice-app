import { execFileSync } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { checkDependencies, checkRun } from './dependabot-policy.mjs';

const { GITHUB_EVENT_PATH, GITHUB_OUTPUT, GITHUB_REPOSITORY: repo } = process.env;
const { workflow_run: run } = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8'));
const number = Array.isArray(run?.pull_requests) && run.pull_requests.length === 1
  ? run.pull_requests[0]?.number
  : null;

function gh(...args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}
const api = (path, ...args) => JSON.parse(gh('api', `repos/${repo}/${path}`, ...args));
const manifest = (path, ref) => JSON.parse(gh('api', `repos/${repo}/contents/${path}?ref=${ref}`,
  '-H', 'Accept: application/vnd.github.raw+json'));

function main() {
  if (!Number.isSafeInteger(number) || number < 1 || !/^[a-f0-9]{40}$/.test(run?.head_sha)) {
    console.log('CI実行とPRを一意に紐づけられないため対象外です');
    return;
  }
  const pr = api(`pulls/${number}`);
  const base = api('git/ref/heads/main').object.sha;
  const commit = api(`commits/${run.head_sha}`);
  const rules = api('rules/branches/main?per_page=100');
  try {
    checkRun({ run, repo, pr, base, commit, rules });
    if (pr.changed_files !== 2) throw new Error('変更対象はファイル2件のみです');
    const files = api(`pulls/${number}/files?per_page=3`);
    const change = checkDependencies({
      files,
      previousManifest: manifest('package.json', base),
      nextManifest: manifest('package.json', run.head_sha),
      previousLock: manifest('package-lock.json', base),
      nextLock: manifest('package-lock.json', run.head_sha),
    });
    console.log(`検証済み: ${change.name} ${change.from} -> ${change.to}`);
  } catch (error) {
    console.log(`自動マージせず手動レビュー: ${error.message}`);
    return;
  }

  if (api('git/ref/heads/main').object.sha !== base) {
    console.log('mainが進んだため、最新mainで再テストが必要です');
    return;
  }
  // REST の sha は gh pr merge --match-head-commit に相当する即時マージの条件。
  // HEAD の競合は sha、main の競合はサーバー側のstrict rulesetで拒否する。
  const result = api(`pulls/${number}/merge`, '--method', 'PUT',
    '-f', `sha=${run.head_sha}`, '-f', 'merge_method=merge');
  if (result.merged !== true) throw new Error('GitHubがマージを受け付けませんでした');
  const merged = api(`pulls/${number}`);
  if (merged.merged !== true || merged.head?.sha !== run.head_sha || merged.merge_commit_sha !== result.sha || !/^[a-f0-9]{40}$/.test(result.sha)) {
    throw new Error('マージを確認できません。Deployは開始していません');
  }
  appendFileSync(GITHUB_OUTPUT, 'merged=true\n');
}
main();

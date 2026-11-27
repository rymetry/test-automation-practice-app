import { q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';

const ENABLE_DELAY_MS = 1500;
const JOB_STEP_MS = 300;
const JOB_STEP_INCREMENT = 20;
const JOB_MAX = 100;
const INITIAL_FEED_COUNT = 10;
const FEED_BATCH_SIZE = 10;
const MAX_FEED_COUNT = 50;

/** 遅延有効化・プログレスバー・無限スクロールの待機を練習するページ。 */
export const dynamicPage: Page = (root) => {
  const view = page(
    'Dynamic states',
    '遅延によるボタンの有効化、進行するプログレスバー、スクロールで追加読み込みされるリストを扱う練習ページです。各領域は名前付き region で分かれており、リロードすると初期状態に戻ります。',
    `
      <section aria-labelledby="delayed-enable-title" class="card">
        <h2 id="delayed-enable-title">Delayed enable</h2>
        <div class="row">
          <button type="button" data-testid="enable-action">Enable action</button>
          <button type="button" class="btn-primary" disabled data-testid="delayed-action">Run action</button>
        </div>
        <p role="status" aria-label="Delayed action status" class="result" data-testid="delayed-result"></p>
      </section>

      <section aria-labelledby="job-progress-title" class="card">
        <h2 id="job-progress-title">Job progress</h2>
        <div class="row">
          <button type="button" class="btn-primary" data-testid="start-job">Start job</button>
        </div>
        <div
          role="progressbar"
          aria-label="Job progress"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="0"
          class="progressbar"
          data-testid="job-progress"
        >
          <div class="progressbar-fill" style="transform: scaleX(0)"></div>
        </div>
        <p role="status" aria-label="Job status" class="result" data-testid="job-result"></p>
      </section>

      <section aria-labelledby="infinite-feed-title" class="card">
        <h2 id="infinite-feed-title">Infinite feed</h2>
        <p class="muted" data-testid="feed-count">Showing ${INITIAL_FEED_COUNT} of ${MAX_FEED_COUNT}</p>
        <div class="feed-container" data-testid="feed-container">
          <ul aria-label="Feed items" class="feed-list" data-testid="feed-list"></ul>
          <div class="feed-sentinel" aria-hidden="true"></div>
        </div>
        <div class="row" style="margin-top: var(--space-3)">
          <button type="button" data-testid="load-more">Load more</button>
        </div>
      </section>
    `,
  );
  root.append(view);

  // Region 1: Delayed enable
  const enableButton = q<HTMLButtonElement>(view, '[data-testid="enable-action"]');
  const delayedActionButton = q<HTMLButtonElement>(view, '[data-testid="delayed-action"]');
  const delayedResult = q(view, '[data-testid="delayed-result"]');
  let enableTimer: ReturnType<typeof setTimeout> | null = null;

  enableButton.addEventListener('click', () => {
    if (enableTimer !== null) return;
    enableButton.disabled = true;
    delayedActionButton.disabled = true;
    delayedResult.textContent = '';

    enableTimer = setTimeout(() => {
      enableTimer = null;
      delayedActionButton.disabled = false;
      enableButton.disabled = false;
    }, ENABLE_DELAY_MS);
  });

  delayedActionButton.addEventListener('click', () => {
    delayedResult.textContent = 'Action executed';
  });

  // Region 2: Job progress
  const startJobButton = q<HTMLButtonElement>(view, '[data-testid="start-job"]');
  const progressBar = q(view, '[data-testid="job-progress"]');
  const progressFill = q<HTMLElement>(progressBar, '.progressbar-fill');
  const jobResult = q(view, '[data-testid="job-result"]');
  let jobInterval: ReturnType<typeof setInterval> | null = null;

  const setProgress = (value: number): void => {
    progressBar.setAttribute('aria-valuenow', String(value));
    progressFill.style.transform = `scaleX(${value / JOB_MAX})`;
  };

  startJobButton.addEventListener('click', () => {
    if (jobInterval !== null) return;
    startJobButton.disabled = true;
    jobResult.textContent = '';
    let progress = 0;
    setProgress(0);

    jobInterval = setInterval(() => {
      progress = Math.min(progress + JOB_STEP_INCREMENT, JOB_MAX);
      setProgress(progress);

      if (progress >= JOB_MAX) {
        if (jobInterval !== null) {
          clearInterval(jobInterval);
          jobInterval = null;
        }
        jobResult.textContent = 'Job completed';
        startJobButton.disabled = false;
      }
    }, JOB_STEP_MS);
  });

  // Region 3: Infinite feed
  const feedCount = q(view, '[data-testid="feed-count"]');
  const feedContainer = q<HTMLElement>(view, '[data-testid="feed-container"]');
  const feedList = q(view, '[data-testid="feed-list"]');
  const sentinel = q(feedContainer, '.feed-sentinel');
  const loadMoreButton = q<HTMLButtonElement>(view, '[data-testid="load-more"]');
  let count = 0;

  const appendItems = (batchSize: number): void => {
    const nextCount = Math.min(count + batchSize, MAX_FEED_COUNT);
    if (nextCount === count) return;

    const fragment = document.createDocumentFragment();
    for (let i = count + 1; i <= nextCount; i += 1) {
      const item = document.createElement('li');
      item.dataset.testid = 'feed-item';
      item.textContent = `Item ${i}`;
      fragment.append(item);
    }
    feedList.append(fragment);
    count = nextCount;
    feedCount.textContent = `Showing ${count} of ${MAX_FEED_COUNT}`;

    if (count >= MAX_FEED_COUNT) {
      loadMoreButton.disabled = true;
      observer.disconnect();
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      // 初期描画時の誤発火を防ぐため、実際にスクロールされた後のみ追加読み込みする。
      const hit = entries.some((entry) => entry.isIntersecting);
      if (hit && feedContainer.scrollTop > 0 && count < MAX_FEED_COUNT) {
        appendItems(FEED_BATCH_SIZE);
      }
    },
    { root: feedContainer, threshold: 0 },
  );

  appendItems(INITIAL_FEED_COUNT);
  observer.observe(sentinel);

  loadMoreButton.addEventListener('click', () => {
    appendItems(FEED_BATCH_SIZE);
  });

  return () => {
    if (enableTimer !== null) {
      clearTimeout(enableTimer);
      enableTimer = null;
    }
    if (jobInterval !== null) {
      clearInterval(jobInterval);
      jobInterval = null;
    }
    observer.disconnect();
  };
};

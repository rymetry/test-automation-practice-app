import { useEffect, useRef, useState, type JSX } from 'react';
import type { Page } from '../../router';
import { mountReact } from '../../ui/mount-react';
import { PageLayout } from '../../ui/PageLayout';

const ENABLE_DELAY_MS = 1500;
const JOB_STEP_MS = 300;
const JOB_STEP_INCREMENT = 20;
const JOB_MAX = 100;
const INITIAL_FEED_COUNT = 10;
const FEED_BATCH_SIZE = 10;
const MAX_FEED_COUNT = 50;

/** 遅延有効化・プログレスバー・無限スクロールの待機を練習するページ。 */
export function DynamicPage(): JSX.Element {
  // Region 1: Delayed enable
  const [enabling, setEnabling] = useState(false);
  const [actionEnabled, setActionEnabled] = useState(false);
  const [delayedResult, setDelayedResult] = useState('');
  const enableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Region 2: Job progress
  const [jobRunning, setJobRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobResult, setJobResult] = useState('');
  const jobIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Region 3: Infinite feed
  const [feedCount, setFeedCount] = useState(INITIAL_FEED_COUNT);
  const feedContainerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFeedComplete = feedCount >= MAX_FEED_COUNT;

  useEffect(() => {
    return () => {
      if (enableTimerRef.current !== null) {
        clearTimeout(enableTimerRef.current);
        enableTimerRef.current = null;
      }
      if (jobIntervalRef.current !== null) {
        clearInterval(jobIntervalRef.current);
        jobIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isFeedComplete) return;
    const container = feedContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!container || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 初期描画時の誤発火を防ぐため、実際にスクロールされた後のみ追加読み込みする。
        const hit = entries.some((entry) => entry.isIntersecting);
        if (hit && container.scrollTop > 0) {
          setFeedCount((current) => Math.min(current + FEED_BATCH_SIZE, MAX_FEED_COUNT));
        }
      },
      { root: container, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [isFeedComplete]);

  function handleEnableAction(): void {
    if (enableTimerRef.current !== null) return;
    setEnabling(true);
    setActionEnabled(false);
    setDelayedResult('');

    enableTimerRef.current = setTimeout(() => {
      enableTimerRef.current = null;
      setActionEnabled(true);
      setEnabling(false);
    }, ENABLE_DELAY_MS);
  }

  function handleStartJob(): void {
    if (jobIntervalRef.current !== null) return;
    setJobRunning(true);
    setJobResult('');
    setProgress(0);
    let current = 0;

    jobIntervalRef.current = setInterval(() => {
      current = Math.min(current + JOB_STEP_INCREMENT, JOB_MAX);
      setProgress(current);

      if (current >= JOB_MAX) {
        if (jobIntervalRef.current !== null) {
          clearInterval(jobIntervalRef.current);
          jobIntervalRef.current = null;
        }
        setJobResult('Job completed');
        setJobRunning(false);
      }
    }, JOB_STEP_MS);
  }

  function handleLoadMore(): void {
    setFeedCount((current) => Math.min(current + FEED_BATCH_SIZE, MAX_FEED_COUNT));
  }

  return (
    <PageLayout
      title="Dynamic states"
      intro="遅延によるボタンの有効化、進行するプログレスバー、スクロールで追加読み込みされるリストを扱う練習ページです。各領域は名前付き region で分かれており、リロードすると初期状態に戻ります。"
      size="medium"
    >
      <div className="grid-2 grid-2-stretch">
        <section aria-labelledby="delayed-enable-title" className="card">
          <h2 id="delayed-enable-title">Delayed enable</h2>
          <div className="row">
            <button type="button" disabled={enabling} data-testid="enable-action" onClick={handleEnableAction}>
              Enable action
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!actionEnabled}
              data-testid="delayed-action"
              onClick={() => setDelayedResult('Action executed')}
            >
              Run action
            </button>
          </div>
          <p role="status" aria-label="Delayed action status" className="result" data-testid="delayed-result">
            {delayedResult || null}
          </p>
        </section>

        <section aria-labelledby="job-progress-title" className="card">
          <h2 id="job-progress-title">Job progress</h2>
          <div className="row">
            <button type="button" className="btn-primary" disabled={jobRunning} data-testid="start-job" onClick={handleStartJob}>
              Start job
            </button>
          </div>
          <div
            role="progressbar"
            aria-label="Job progress"
            aria-valuemin={0}
            aria-valuemax={JOB_MAX}
            aria-valuenow={progress}
            className="progressbar"
            data-testid="job-progress"
          >
            <div className="progressbar-fill" style={{ transform: `scaleX(${progress / JOB_MAX})` }} />
          </div>
          <p role="status" aria-label="Job status" className="result" data-testid="job-result">
            {jobResult || null}
          </p>
        </section>
      </div>

      <section aria-labelledby="infinite-feed-title" className="card">
        <h2 id="infinite-feed-title">Infinite feed</h2>
        <p className="muted" data-testid="feed-count">
          Showing {feedCount} of {MAX_FEED_COUNT}
        </p>
        <div ref={feedContainerRef} className="feed-container" data-testid="feed-container">
          <ul aria-label="Feed items" className="feed-list" data-testid="feed-list">
            {Array.from({ length: feedCount }, (_, index) => (
              <li key={index + 1} data-testid="feed-item">
                Item {index + 1}
              </li>
            ))}
          </ul>
          <div ref={sentinelRef} className="feed-sentinel" aria-hidden="true" />
        </div>
        <div className="row" style={{ marginTop: 'var(--space-3)' }}>
          <button type="button" disabled={isFeedComplete} data-testid="load-more" onClick={handleLoadMore}>
            Load more
          </button>
        </div>
      </section>
    </PageLayout>
  );
}

export const dynamicPage: Page = mountReact(DynamicPage);

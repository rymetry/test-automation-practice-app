import { useEffect, useState, type JSX } from 'react';
import type { Page } from '../router';
import { mountReact } from '../ui/mount-react';
import { useDocumentTitle } from '../ui/PageLayout';

const DELAY_MS = 2000;

/** 最初に "Loading…" を出し、2 秒後に本体を表示する待機練習ページ。 */
export function SlowPage(): JSX.Element {
  useDocumentTitle('Slow page');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoaded(true);
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="page-narrow">
      <h1>Slow page</h1>
      {loaded ? (
        <div className="card" data-testid="loaded">
          <h2>Loaded</h2>
          <p>この内容はページを開いてから {DELAY_MS / 1000} 秒後に表示されました。</p>
        </div>
      ) : (
        <p role="status" className="card" data-testid="loading">
          Loading…
        </p>
      )}
    </section>
  );
}

export const slowPage: Page = mountReact(SlowPage);

import { html, setTitle } from '../dom';
import type { Page } from '../router';

const DELAY_MS = 2000;

/** Shows "Loading…" first and the real content two seconds later. Made for practising waits. */
export const slowPage: Page = (root) => {
  setTitle('Slow page');

  const view = html(`
    <section>
      <h1>Slow page</h1>
      <p role="status" data-testid="loading">Loading…</p>
    </section>
  `);
  root.append(view);

  const timer = setTimeout(() => {
    view.querySelector('[data-testid="loading"]')?.remove();
    view.append(
      html(`
        <div data-testid="loaded">
          <h2>Loaded</h2>
          <p>この内容はページを開いてから ${DELAY_MS / 1000} 秒後に表示されました。</p>
        </div>
      `),
    );
  }, DELAY_MS);

  return () => clearTimeout(timer);
};

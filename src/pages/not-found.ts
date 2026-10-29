import { esc, html, setTitle } from '../dom';
import type { Page } from '../router';

export const notFoundPage: Page = (root) => {
  setTitle('Not found');
  root.append(
    html(`
      <section>
        <h1>Page not found</h1>
        <p><code>${esc(location.pathname)}</code> には何もありません。</p>
        <p><a href="/">ホームに戻る</a></p>
      </section>
    `),
  );
};

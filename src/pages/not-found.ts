import { esc, html, setTitle } from '../dom';
import type { Page } from '../router';

export const notFoundPage: Page = (root) => {
  setTitle('Not found');
  root.append(
    html(`
      <section class="page-narrow">
        <h1>Page not found</h1>
        <div class="card">
          <p><code>${esc(location.pathname)}</code> には何もありません。</p>
          <p><a href="/">ホームに戻る</a></p>
        </div>
      </section>
    `),
  );
};

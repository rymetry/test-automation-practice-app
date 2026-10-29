import { esc, html, setTitle } from '../dom';
import type { Page } from '../router';

export const notFoundPage: Page = (root) => {
  setTitle('Not found');
  root.append(
    html(`
      <section>
        <h1>Page not found</h1>
        <p>There is nothing at <code>${esc(location.pathname)}</code>.</p>
        <p><a href="/">Back to the home page</a></p>
      </section>
    `),
  );
};

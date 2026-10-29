import { html, q, setTitle } from '../dom';
import type { Page } from '../router';

/** Two buttons with the same name, in two regions. Made for practising locators that match too much. */
export const ambiguousPage: Page = (root) => {
  setTitle('Ambiguous page');

  const view = html(`
    <section>
      <h1>Ambiguous page</h1>
      <p>Both regions below have a button called "Delete". A locator has to say which one it means.</p>
      <section aria-labelledby="drafts-title" data-testid="drafts" class="card">
        <h2 id="drafts-title">Drafts</h2>
        <p>Weekly report (draft)</p>
        <button type="button" data-testid="delete-draft">Delete</button>
      </section>
      <section aria-labelledby="published-title" data-testid="published" class="card">
        <h2 id="published-title">Published</h2>
        <p>Release notes 1.0</p>
        <button type="button" data-testid="delete-published">Delete</button>
      </section>
      <p role="status" data-testid="ambiguous-result"></p>
    </section>
  `);
  root.append(view);

  const result = q(view, '[data-testid="ambiguous-result"]');
  q(view, '[data-testid="delete-draft"]').addEventListener('click', () => {
    result.textContent = 'Deleted the draft';
  });
  q(view, '[data-testid="delete-published"]').addEventListener('click', () => {
    result.textContent = 'Deleted the published post';
  });
};

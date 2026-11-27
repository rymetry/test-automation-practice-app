import { html, setTitle } from '../dom';
import type { Page } from '../router';

/** target="_blank" で開かれる別タブ遷移の検証用ページ。 */
export const newTabPage: Page = (root) => {
  setTitle('New tab page');
  root.append(
    html(`
      <section class="page-narrow">
        <h1>New tab page</h1>
        <p class="page-intro">別タブ（target="_blank"）から開かれたページです。同じオリジンなのでセッション Cookie は共有されます。</p>
        <div class="card">
          <p role="status" class="result" data-testid="new-tab-status">Opened in a new tab</p>
          <p><a href="/overlays/browser">Back to alerts</a></p>
        </div>
      </section>
    `),
  );
};

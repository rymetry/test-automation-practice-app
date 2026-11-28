import type { JSX } from 'react';
import type { Page } from '../router';
import { mountReact } from '../ui/mount-react';
import { useDocumentTitle } from '../ui/PageLayout';

/** target="_blank" で開かれる別タブ遷移の検証用ページ。 */
export function NewTabPage(): JSX.Element {
  useDocumentTitle('New tab page');

  return (
    <section className="page-narrow">
      <h1>New tab page</h1>
      <p className="page-intro">
        別タブ（target=&quot;_blank&quot;）から開かれたページです。同じオリジンなのでセッション Cookie は共有されます。
      </p>
      <div className="card">
        <p role="status" className="result" data-testid="new-tab-status">
          Opened in a new tab
        </p>
        <p>
          <a href="/overlays/browser">Back to alerts</a>
        </p>
      </div>
    </section>
  );
}

export const newTabPage: Page = mountReact(NewTabPage);

import { useState, type JSX } from 'react';
import { useDocumentTitle } from '../ui/PageLayout';

/** 同じ名前のボタンを 2 つの領域に置き、スコープ指定のロケータを練習するページ。 */
export function AmbiguousPage(): JSX.Element {
  useDocumentTitle('Ambiguous page');
  const [result, setResult] = useState('');

  return (
    <section className="page-medium">
      <h1>Ambiguous page</h1>
      <p className="page-intro">
        下の 2 つの領域にはどちらも &quot;Delete&quot; というボタンがあります。ロケータはどちらを指すのかを明示する必要があります。
      </p>
      <div className="grid-2 grid-2-stretch">
        <section aria-labelledby="drafts-title" data-testid="drafts" className="card">
          <h2 id="drafts-title">Drafts</h2>
          <p>週次レポート（下書き）</p>
          <button type="button" data-testid="delete-draft" onClick={() => setResult('Deleted the draft')}>
            Delete
          </button>
        </section>
        <section aria-labelledby="published-title" data-testid="published" className="card">
          <h2 id="published-title">Published</h2>
          <p>リリースノート 1.0</p>
          <button type="button" data-testid="delete-published" onClick={() => setResult('Deleted the published post')}>
            Delete
          </button>
        </section>
      </div>
      <p role="status" data-testid="ambiguous-result">
        {result || null}
      </p>
    </section>
  );
}


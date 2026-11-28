import { useState, type JSX } from 'react';
import type { Page } from '../../router';
import { mountReact } from '../../ui/mount-react';
import { PageLayout } from '../../ui/PageLayout';

/** ブラウザ標準の alert / confirm / prompt と別タブ遷移を練習するページ。 */
export function BrowserAlertsPage(): JSX.Element {
  const [result, setResult] = useState('');

  const handleAlert = (): void => {
    window.alert('Hello from alert');
    setResult('Alert acknowledged');
  };

  const handleConfirm = (): void => {
    const confirmed = window.confirm('Proceed with action?');
    setResult(confirmed ? 'Confirmed' : 'Dismissed');
  };

  const handlePrompt = (): void => {
    const value = window.prompt('Enter a label', 'default');
    if (value === null) {
      setResult('Cancelled');
      return;
    }
    const trimmed = value.trim();
    setResult(trimmed ? `Entered: ${trimmed}` : 'Entered: (empty)');
  };

  return (
    <PageLayout
      title="Browser alerts"
      intro="ブラウザ標準の alert・confirm・prompt と、別タブ遷移の動作を確認するページです。各ボタンで表示される通知への応答結果が下のステータスに反映されます。"
      size="medium"
    >
      <section className="card" aria-labelledby="native-dialogs-title">
        <h2 id="native-dialogs-title">Native alerts &amp; prompts</h2>
        <div className="row">
          <button type="button" data-testid="trigger-alert" onClick={handleAlert}>
            Trigger alert
          </button>
          <button type="button" data-testid="trigger-confirm" onClick={handleConfirm}>
            Trigger confirm
          </button>
          <button type="button" data-testid="trigger-prompt" onClick={handlePrompt}>
            Trigger prompt
          </button>
        </div>
        <p role="status" className="result" data-testid="browser-alert-result">
          {result || null}
        </p>
      </section>

      <section className="card" aria-labelledby="new-tab-title">
        <h2 id="new-tab-title">New tab</h2>
        <p>
          別タブ（<code>target=&quot;_blank&quot;</code>）で補助ページを開きます。
        </p>
        <div className="row">
          <a href="/new-tab" target="_blank" rel="noopener noreferrer" className="btn" data-testid="open-new-tab">
            Open in new tab
          </a>
        </div>
      </section>
    </PageLayout>
  );
}

export const browserAlertsPage: Page = mountReact(BrowserAlertsPage);

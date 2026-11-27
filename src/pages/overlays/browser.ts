import { q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';

/** ブラウザ標準の alert / confirm / prompt と別タブ遷移を練習するページ。 */
export const browserAlertsPage: Page = (root) => {
  const view = page(
    'Browser alerts',
    'ブラウザ標準の alert・confirm・prompt と、別タブ遷移の動作を確認するページです。各ボタンで表示される通知への応答結果が下のステータスに反映されます。',
    `
      <section class="card" aria-labelledby="native-dialogs-title">
        <h2 id="native-dialogs-title">Native alerts &amp; prompts</h2>
        <div class="row">
          <button type="button" data-testid="trigger-alert">Trigger alert</button>
          <button type="button" data-testid="trigger-confirm">Trigger confirm</button>
          <button type="button" data-testid="trigger-prompt">Trigger prompt</button>
        </div>
        <p role="status" class="result" data-testid="browser-alert-result"></p>
      </section>

      <section class="card" aria-labelledby="new-tab-title">
        <h2 id="new-tab-title">New tab</h2>
        <p>別タブ（<code>target="_blank"</code>）で補助ページを開きます。</p>
        <div class="row">
          <a href="/new-tab" target="_blank" rel="noopener noreferrer" class="btn" data-testid="open-new-tab">Open in new tab</a>
        </div>
      </section>
    `,
  );
  root.append(view);

  const result = q(view, '[data-testid="browser-alert-result"]');

  q(view, '[data-testid="trigger-alert"]').addEventListener('click', () => {
    window.alert('Hello from alert');
    result.textContent = 'Alert acknowledged';
  });

  q(view, '[data-testid="trigger-confirm"]').addEventListener('click', () => {
    const confirmed = window.confirm('Proceed with action?');
    result.textContent = confirmed ? 'Confirmed' : 'Dismissed';
  });

  q(view, '[data-testid="trigger-prompt"]').addEventListener('click', () => {
    const value = window.prompt('Enter a label', 'default');
    if (value === null) {
      result.textContent = 'Cancelled';
      return;
    }
    const trimmed = value.trim();
    result.textContent = trimmed ? `Entered: ${trimmed}` : 'Entered: (empty)';
  });
};

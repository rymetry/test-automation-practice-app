import { html, q, setTitle } from '../dom';

/** iframe 埋め込み専用の軽量フォーム画面。共通シェルや /api/me を使わず直接 #app に描画する。 */
export function mountEmbedForm(app: HTMLElement): void {
  app.dataset.embed = 'true';
  setTitle('Embedded form');

  const view = html(`
    <main class="embed-main">
      <h1>Embedded form</h1>
      <form class="stack" data-testid="frame-form" novalidate>
        <div class="field">
          <label for="frame-note">Frame note</label>
          <input id="frame-note" name="note" type="text" autocomplete="off" data-testid="frame-note" />
        </div>
        <button type="submit" data-testid="frame-send">Send from frame</button>
      </form>
      <p role="status" aria-label="Embedded form status" class="result" data-testid="frame-result"></p>
    </main>
  `);
  app.replaceChildren(view);

  const form = q<HTMLFormElement>(view, '[data-testid="frame-form"]');
  const input = q<HTMLInputElement>(form, '[data-testid="frame-note"]');
  const result = q(view, '[data-testid="frame-result"]');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const note = input.value.trim();
    if (!note) {
      result.textContent = 'Frame note is required';
      return;
    }

    result.textContent = `Sent from frame: ${note}`;
    input.value = '';

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'practice:frame-note', note }, window.location.origin);
    }
  });
}

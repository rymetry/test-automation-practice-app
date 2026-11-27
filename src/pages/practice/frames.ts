import { q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';

interface FrameNoteMessage {
  type: 'practice:frame-note';
  note: string;
}

const SHADOW_STYLES = `
  :host {
    display: block;
    color-scheme: inherit;
    color: var(--fg);
    font: inherit;
    font-size: var(--text-body, 0.9375rem);
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 24rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  label {
    font-size: var(--text-body, 0.9375rem);
    font-weight: 500;
    color: var(--fg);
  }

  input {
    width: 100%;
    padding: 0.45rem 0.65rem;
    font: inherit;
    color: var(--fg);
    background: var(--surface);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
    transition:
      border-color var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
      box-shadow var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  }

  input::placeholder {
    color: var(--fg-muted);
  }

  input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
    outline: none;
  }

  button {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.25rem;
    padding: 0.4rem 0.9rem;
    font: inherit;
    font-weight: 500;
    color: var(--accent-fg);
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      background-color var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
      border-color var(--duration-fast, 150ms) var(--ease-out, cubic-bezier(0.22, 1, 0.36, 1));
  }

  button:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .result {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm, 0.8125rem);
    color: var(--fg);
    background: var(--surface-sunken);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-sm);
  }

  .result:empty {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    input,
    button {
      transition: none;
    }
  }
`;

class PracticeShadowCard extends HTMLElement {
  constructor() {
    super();
    // 同一インスタンスの重複初期化を避けるため、constructor で一度だけ Shadow Root を構築する。
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${SHADOW_STYLES}</style>
      <form data-testid="shadow-form" novalidate>
        <div class="field">
          <label for="shadow-input">Shadow input</label>
          <input id="shadow-input" name="value" type="text" autocomplete="off" data-testid="shadow-input" />
        </div>
        <button type="submit" data-testid="shadow-apply">Apply shadow</button>
        <p role="status" aria-label="Shadow status" class="result" data-testid="shadow-result"></p>
      </form>
    `;

    const form = q<HTMLFormElement>(shadow, '[data-testid="shadow-form"]');
    const input = q<HTMLInputElement>(shadow, '[data-testid="shadow-input"]');
    const result = q(shadow, '[data-testid="shadow-result"]');

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        result.textContent = 'Shadow input is required';
        return;
      }

      result.textContent = `Applied in shadow: ${value}`;
      input.value = '';
    });
  }
}

// ルート再訪時に二重登録例外を起こさないよう、モジュール評価時に一度だけ定義する。
if (!customElements.get('practice-shadow-card')) {
  customElements.define('practice-shadow-card', PracticeShadowCard);
}

function isFrameNoteMessage(data: unknown): data is FrameNoteMessage {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return candidate.type === 'practice:frame-note' && typeof candidate.note === 'string';
}

/** iframe と Open Shadow DOM を名前付き region で分けて操作する練習ページ。 */
export const framesPage: Page = (root) => {
  const view = page(
    'Iframe & Shadow DOM',
    'iframe 内の埋め込みフォームと Open Shadow DOM 内のカスタム要素を操作する練習ページです。各領域は名前付き region で分かれており、リロードすると初期状態に戻ります。',
    `
      <section aria-labelledby="iframe-region-title" class="card">
        <h2 id="iframe-region-title">Embedded iframe</h2>
        <iframe title="Embedded form" src="/embed/form" class="embed-frame" data-testid="embedded-frame"></iframe>
        <p role="status" aria-label="Iframe status" class="result" data-testid="frame-parent-result"></p>
      </section>
      <section aria-labelledby="shadow-region-title" class="card">
        <h2 id="shadow-region-title">Shadow DOM</h2>
        <practice-shadow-card data-testid="shadow-host"></practice-shadow-card>
      </section>
    `,
  );
  root.append(view);

  const iframe = q<HTMLIFrameElement>(view, '[data-testid="embedded-frame"]');
  const parentResult = q(view, '[data-testid="frame-parent-result"]');

  const onMessage = (event: MessageEvent): void => {
    if (event.origin !== window.location.origin) return;
    if (!iframe.contentWindow || event.source !== iframe.contentWindow) return;
    if (!isFrameNoteMessage(event.data)) return;

    parentResult.textContent = `Received from frame: ${event.data.note}`;
  };

  window.addEventListener('message', onMessage);

  return () => {
    window.removeEventListener('message', onMessage);
  };
};

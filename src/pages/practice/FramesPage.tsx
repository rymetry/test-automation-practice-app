import {
  useEffect,
  useRef,
  useState,
  type DetailedHTMLProps,
  type HTMLAttributes,
  type JSX,
} from 'react';
import { PageLayout } from '../../ui/PageLayout';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'practice-shadow-card': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        'data-testid'?: string;
      };
    }
  }
}

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
    max-width: 100%;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
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
    font-size: var(--text-body, 0.9375rem);
    color: var(--fg);
    background: var(--surface-sunken);
    border: 0;
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

    const form = shadow.querySelector<HTMLFormElement>('[data-testid="shadow-form"]');
    const input = shadow.querySelector<HTMLInputElement>('[data-testid="shadow-input"]');
    const result = shadow.querySelector<HTMLElement>('[data-testid="shadow-result"]');
    if (!form || !input || !result) return;

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
if (typeof customElements !== 'undefined' && !customElements.get('practice-shadow-card')) {
  customElements.define('practice-shadow-card', PracticeShadowCard);
}

function isFrameNoteMessage(data: unknown): data is FrameNoteMessage {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as Record<string, unknown>;
  return candidate.type === 'practice:frame-note' && typeof candidate.note === 'string';
}

/** iframe と Open Shadow DOM を名前付き region で分けて操作する練習ページ。 */
export function FramesPage(): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [parentResult, setParentResult] = useState('');

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return;
      const contentWindow = iframeRef.current?.contentWindow;
      if (!contentWindow || event.source !== contentWindow) return;
      if (!isFrameNoteMessage(event.data)) return;

      setParentResult(`Received from frame: ${event.data.note}`);
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, []);

  return (
    <PageLayout
      title="Iframe & Shadow DOM"
      intro="iframe 内の埋め込みフォームと Open Shadow DOM 内のカスタム要素を操作する練習ページです。各領域は名前付き region で分かれており、リロードすると初期状態に戻ります。"
    >
      <div className="grid-2 grid-2-stretch">
        <section aria-labelledby="iframe-region-title" className="card">
          <h2 id="iframe-region-title">Embedded iframe</h2>
          <iframe
            ref={iframeRef}
            title="Embedded form"
            src="/embed/form"
            className="embed-frame"
            data-testid="embedded-frame"
          />
          <p role="status" aria-label="Iframe status" className="result" data-testid="frame-parent-result">
            {parentResult || null}
          </p>
        </section>
        <section aria-labelledby="shadow-region-title" className="card">
          <h2 id="shadow-region-title">Shadow DOM</h2>
          <practice-shadow-card data-testid="shadow-host" />
        </section>
      </div>
    </PageLayout>
  );
}


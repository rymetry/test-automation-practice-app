import { useEffect, useLayoutEffect, useState, type FormEvent, type JSX } from 'react';
import { useDocumentTitle } from '../ui/PageLayout';

/** iframe 埋め込み専用の軽量フォーム画面。共通シェルや /api/me を使わず直接 #app に描画する。 */
export function EmbedFormPage(): JSX.Element {
  useDocumentTitle('Embedded form');
  const [note, setNote] = useState('');
  const [result, setResult] = useState('');

  useLayoutEffect(() => {
    const app = document.querySelector<HTMLElement>('#app');
    if (!app) return;
    app.dataset.embed = 'true';
    return () => {
      delete app.dataset.embed;
    };
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== 'theme' && event.key !== null) return;
      try {
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
        else delete document.documentElement.dataset.theme;
      } catch {
        // ストレージが利用できない場合は現在の表示を維持する。
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = note.trim();
    if (!trimmed) {
      setResult('Frame note is required');
      return;
    }

    setResult(`Sent from frame: ${trimmed}`);
    setNote('');

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'practice:frame-note', note: trimmed }, window.location.origin);
    }
  }

  return (
    <main className="embed-main">
      <h1>Embedded form</h1>
      <form className="stack" data-testid="frame-form" noValidate onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="frame-note">Frame note</label>
          <input
            id="frame-note"
            name="note"
            type="text"
            autoComplete="off"
            data-testid="frame-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <div>
          <button type="submit" data-testid="frame-send">
            Send from frame
          </button>
        </div>
      </form>
      <p role="status" aria-label="Embedded form status" className="result" data-testid="frame-result">
        {result || null}
      </p>
    </main>
  );
}

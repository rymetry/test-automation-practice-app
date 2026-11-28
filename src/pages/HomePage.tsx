import { useEffect, useRef, useState, type JSX } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { useAuth } from '../auth';
import { ALL_LINKS } from '../nav';
import { useDocumentTitle } from '../ui/PageLayout';

export function HomePage(): JSX.Element {
  useDocumentTitle('Home');
  const { clearAuth } = useAuth();
  const [query, setQuery] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const resettingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleResetSession(): Promise<void> {
    if (resettingRef.current) return;
    resettingRef.current = true;
    setResetting(true);
    setResetError(null);
    setResetResult('');

    try {
      const result = await api.reset();
      if (result.status === 204) {
        // 画面遷移後でもサーバー側セッションが初期化されたなら、認証コンテキストは必ず未サインインへ同期する。
        clearAuth();
        if (mountedRef.current) {
          setResetResult('Session has been reset');
        }
      } else if (mountedRef.current) {
        setResetError('Could not reset the session');
      }
    } catch {
      if (mountedRef.current) {
        setResetError('Could not reset the session');
      }
    } finally {
      resettingRef.current = false;
      if (mountedRef.current) {
        setResetting(false);
      }
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredLinks = normalizedQuery
    ? ALL_LINKS.filter(
        (link) =>
          link.label.toLowerCase().includes(normalizedQuery) ||
          link.description.toLowerCase().includes(normalizedQuery),
      )
    : ALL_LINKS;

  return (
    <section>
      <h1>Testing Sandbox</h1>
      <p>テストを練習するためのサンドボックスアプリです。ここで行った操作はあなた専用のセッションに保存され、1 日経つと消えます。</p>
      <p>左のナビゲーションから、todo の一覧、サインイン、練習用ページと部品ごとのページを開けます。</p>

      <section aria-labelledby="session-reset-title" className="card session-reset">
        <div className="session-reset-header">
          <div>
            <h2 id="session-reset-title">Session reset</h2>
            <p className="muted">
              このセッションの todo、サインイン状態、プラン、各部品・練習ページの保存データを初期状態に戻します。
            </p>
          </div>
          <button
            type="button"
            className="btn-danger"
            data-testid="reset-session"
            disabled={resetting}
            onClick={() => void handleResetSession()}
          >
            Reset session
          </button>
        </div>
        <div data-testid="reset-session-error">
          {resetError ? (
            <p role="alert" className="error">
              {resetError}
            </p>
          ) : null}
        </div>
        <p role="status" className="result" data-testid="reset-session-result">
          {resetResult || null}
        </p>
      </section>

      <h2 id="pages-title">Pages</h2>
      <div className="field page-filter">
        <label htmlFor="page-filter">Filter pages</label>
        <input
          id="page-filter"
          name="filter"
          type="search"
          autoComplete="off"
          data-testid="page-filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <ul aria-labelledby="pages-title" className="card-grid" data-testid="pages">
        {filteredLinks.map((link) => (
          <li key={link.href}>
            <Link to={link.href}>
              <strong>{link.label}</strong>
              <span>{link.description}</span>
            </Link>
          </li>
        ))}
      </ul>
      {filteredLinks.length === 0 ? (
        <p className="muted" data-testid="pages-empty">
          No matching pages
        </p>
      ) : null}
    </section>
  );
}

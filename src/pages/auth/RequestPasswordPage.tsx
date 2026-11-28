import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Link } from 'react-router';
import { api } from '../../api';
import { PageLayout } from '../../ui/PageLayout';

type CopyState = 'idle' | 'copied' | 'error';

/** パスワード再設定用トークンを発行し、メール送信の代わりに画面へ表示するページ。 */
export function RequestPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const copyGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      copyGenerationRef.current += 1;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    copyGenerationRef.current += 1;
    setCopyState('idle');
    setError(null);
    setToken(null);

    if (!email.includes('@')) {
      setError('Email must contain @');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.password.request(email.trim());
      if (!mountedRef.current) return;

      if (response.status === 200 && response.data && 'token' in response.data) {
        setToken(response.data.token);
        return;
      }

      const message = response.data && 'error' in response.data ? response.data.error : 'Could not request a reset';
      setError(message);
    } catch {
      if (!mountedRef.current) return;
      setError('Could not request a reset');
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  async function handleCopyToken(): Promise<void> {
    if (!token) return;
    const generation = ++copyGenerationRef.current;
    setCopyState('idle');

    try {
      if (typeof navigator.clipboard?.writeText !== 'function') {
        if (mountedRef.current && generation === copyGenerationRef.current) {
          setCopyState('error');
        }
        return;
      }
      await navigator.clipboard.writeText(token);
      if (mountedRef.current && generation === copyGenerationRef.current) {
        setCopyState('copied');
      }
    } catch {
      if (mountedRef.current && generation === copyGenerationRef.current) {
        setCopyState('error');
      }
    }
  }

  return (
    <PageLayout
      title="Request password"
      intro="メールアドレスを入れるとリセット用のトークンが発行されます。メールは送れないので、トークンはこの画面に表示します（alice のメールは alice@example.com）。"
      size="narrow"
    >
      <form
        className="card stack stack-wide"
        data-testid="request-password-form"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="field">
          <label htmlFor="request-email">Email</label>
          <input
            id="request-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div data-testid="request-error">
          {error ? (
            <p role="alert" className="error">
              {error}
            </p>
          ) : null}
        </div>
        <div>
          <button type="submit" data-testid="request-password" disabled={submitting}>
            Request password
          </button>
        </div>
      </form>
      <div className="result" role="status" data-testid="request-result">
        {token ? (
          <>
            <span>
              Reset token: <code data-testid="reset-token">{token}</code>
            </span>
            <span>
              {' · '}
              <Link to={`/auth/reset-password?token=${encodeURIComponent(token)}`}>Continue to reset password</Link>
            </span>
          </>
        ) : null}
      </div>
      {token ? (
        <div className="row copy-token-actions">
          <button
            type="button"
            className="btn-sm"
            data-testid="copy-token"
            onClick={() => void handleCopyToken()}
          >
            Copy token
          </button>
          <span aria-live="polite">
            {copyState === 'copied' ? (
              <span className="copy-feedback" data-testid="copy-token-feedback">
                Copied to clipboard
              </span>
            ) : null}
          </span>
          {copyState === 'error' ? (
            <p role="alert" className="error" data-testid="copy-token-error">
              Could not copy the token
            </p>
          ) : null}
        </div>
      ) : null}
    </PageLayout>
  );
}

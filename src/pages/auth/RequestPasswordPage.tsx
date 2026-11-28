import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Link } from 'react-router';
import { api } from '../../api';
import { PageLayout } from '../../ui/PageLayout';

/** パスワード再設定用トークンを発行し、メール送信の代わりに画面へ表示するページ。 */
export function RequestPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setToken(null);

    if (!email.includes('@')) {
      setError('Email must contain @');
      return;
    }

    setSubmitting(true);
    const response = await api.password.request(email.trim());
    if (!mountedRef.current) return;
    setSubmitting(false);

    if (response.status === 200 && response.data && 'token' in response.data) {
      setToken(response.data.token);
      return;
    }

    const message = response.data && 'error' in response.data ? response.data.error : 'Could not request a reset';
    setError(message);
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
    </PageLayout>
  );
}

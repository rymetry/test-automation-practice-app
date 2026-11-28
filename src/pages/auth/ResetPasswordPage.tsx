import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../api';
import { PageLayout } from '../../ui/PageLayout';

/** Request password で発行したトークンを使い新しいパスワードを設定するページ。 */
export function ResetPasswordPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(() => searchParams.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
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
    setChanged(false);

    let problem: string | null = null;
    if (!token.trim()) problem = 'Token is required';
    else if (password.length < 8) problem = 'Password must be at least 8 characters';
    else if (password !== confirm) problem = 'Passwords do not match';

    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    const response = await api.password.reset(token.trim(), password);
    if (!mountedRef.current) return;
    setSubmitting(false);

    if (response.status === 200) {
      setChanged(true);
      // 変更成功時は使用済みトークンを含め全入力欄を空にリセットする。
      setToken('');
      setPassword('');
      setConfirm('');
      return;
    }

    const message = response.data && 'error' in response.data ? response.data.error : 'Could not change the password';
    setError(message);
  }

  return (
    <PageLayout
      title="Reset password"
      intro="Request password で受け取ったトークンで新しいパスワードを設定します。URL に ?token= が付いていれば入力欄に入ります。変更後はそのパスワードでサインインできます。"
      size="narrow"
    >
      <form
        className="card stack stack-wide"
        data-testid="reset-password-form"
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="field">
          <label htmlFor="reset-token">Token</label>
          <input
            id="reset-token"
            name="token"
            type="text"
            autoComplete="off"
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="reset-password">New password</label>
          <input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="reset-confirm">Confirm password</label>
          <input
            id="reset-confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>
        <div data-testid="reset-error">
          {error ? (
            <p role="alert" className="error">
              {error}
            </p>
          ) : null}
        </div>
        <div>
          <button type="submit" data-testid="change-password" disabled={submitting}>
            Change password
          </button>
        </div>
      </form>
      <div className="result" role="status" data-testid="reset-result">
        {changed ? (
          <span>
            Password changed · <Link to="/login">Back to sign in</Link>
          </span>
        ) : null}
      </div>
    </PageLayout>
  );
}

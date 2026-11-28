import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { api } from '../api';
import { refreshAuth } from '../auth';
import { navigate, type Page } from '../router';
import { mountReact } from '../ui/mount-react';
import { useDocumentTitle } from '../ui/PageLayout';

export function LoginPage(): JSX.Element {
  useDocumentTitle('Sign in');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);
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
    setSubmitting(true);
    const result = await api.login(username, password);
    if (!mountedRef.current) return;
    setSubmitting(false);
    if (result.status === 200) {
      await refreshAuth();
      if (!mountedRef.current) return;
      navigate('/todos');
      return;
    }
    setError('Invalid username or password');
    setPassword('');
    passwordRef.current?.focus();
  }

  return (
    <section className="page-narrow">
      <h1>Sign in</h1>
      <form data-testid="login-form" className="card stack stack-wide" onSubmit={(event) => void handleSubmit(event)}>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            data-testid="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            data-testid="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div data-testid="login-error">
          {error ? (
            <p role="alert" className="error">
              {error}
            </p>
          ) : null}
        </div>
        <div>
          <button type="submit" data-testid="sign-in" disabled={submitting}>
            Sign in
          </button>
        </div>
      </form>
    </section>
  );
}

export const loginPage: Page = mountReact(LoginPage);

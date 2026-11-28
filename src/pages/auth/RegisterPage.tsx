import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { PageLayout } from '../../ui/PageLayout';

/** このセッション限定のアカウントを作成し、そのままサインインする画面。 */
export function RegisterPage(): JSX.Element {
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

    let problem: string | null = null;
    if (!fullName.trim()) problem = 'Full name is required';
    else if (!email.includes('@')) problem = 'Email must contain @';
    else if (!username.trim()) problem = 'Username is required';
    else if (password.length < 8) problem = 'Password must be at least 8 characters';
    else if (password !== repeat) problem = 'Passwords do not match';
    else if (!terms) problem = 'You must agree to the terms';

    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    const result = await api
      .register({
        fullName: fullName.trim(),
        email: email.trim(),
        username: username.trim(),
        password,
      })
      .catch(() => null);
    if (!mountedRef.current) return;
    setSubmitting(false);

    if (result?.status === 201) {
      await refreshAuth();
      if (!mountedRef.current) return;
      void navigate('/todos');
      return;
    }

    const message = result?.data && 'error' in result.data ? result.data.error : 'Could not register';
    setError(message);
  }

  return (
    <PageLayout
      title="Register"
      intro="アカウントを作ってサインインします。作ったアカウントはあなたのセッションの中にだけ存在し、POST /api/reset で消えます。ユーザー名は a-z、0-9、_ の 3〜20 文字、パスワードは 8 文字以上です。"
      size="narrow"
    >
      <form className="card stack stack-wide" data-testid="register-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className="field">
          <label htmlFor="register-full-name">Full name</label>
          <input
            id="register-full-name"
            name="fullName"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="register-username">Username</label>
          <input
            id="register-username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="register-repeat">Repeat password</label>
          <input
            id="register-repeat"
            name="repeat"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
        </div>
        <div className="field field-inline">
          <input
            id="register-terms"
            name="terms"
            type="checkbox"
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
          />
          <label htmlFor="register-terms">Agree to Terms &amp; Conditions</label>
        </div>
        <div data-testid="register-error">
          {error ? (
            <p role="alert" className="error">
              {error}
            </p>
          ) : null}
        </div>
        <div>
          <button type="submit" data-testid="register" disabled={submitting}>
            Register
          </button>
        </div>
      </form>
      <p>
        <Link to="/login">Already have an account? Sign in</Link>
      </p>
    </PageLayout>
  );
}

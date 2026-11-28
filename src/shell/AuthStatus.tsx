import { useEffect, useRef, useState, type JSX } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth';

export function AuthStatus(): JSX.Element | null {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (!ready) return null;

  if (!user) {
    return (
      <Link to="/login" className="btn btn-sm" data-testid="sign-in-link">
        Sign in
      </Link>
    );
  }

  const initial = user.slice(0, 1).toUpperCase();

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    try {
      await logout();
      if (mountedRef.current) {
        void navigate('/');
      }
    } finally {
      if (mountedRef.current) {
        setSigningOut(false);
      }
    }
  }

  return (
    <>
      <div className="auth-identity">
        <span className="auth-avatar" aria-hidden="true">
          {initial}
        </span>
        <p className="auth-user">
          Signed in as <strong>{user}</strong>
        </p>
      </div>
      <button type="button" className="btn-sm" data-testid="sign-out" disabled={signingOut} onClick={() => void handleSignOut()}>
        Sign out
      </button>
    </>
  );
}

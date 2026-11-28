import { createContext, useCallback, useContext, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import { api } from './api';

export interface AuthContextValue {
  user: string | null;
  ready: boolean;
  refreshAuth: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let inFlightMe: Promise<string | null> | null = null;

// <StrictMode> の二重 effect 実行や同時呼び出しで Cookie 未確立のセッションが二重発行されないよう、
// 進行中の /api/me リクエストを共有して 1 本にまとめる。
function fetchCurrentUser(): Promise<string | null> {
  if (!inFlightMe) {
    const request = api
      .me()
      .then((result) => (result.status === 200 ? (result.data?.username ?? null) : null))
      .finally(() => {
        if (inFlightMe === request) {
          inFlightMe = null;
        }
      });
    inFlightMe = request;
  }
  return inFlightMe;
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const refreshAuth = useCallback(async (): Promise<string | null> => {
    const nextUser = await fetchCurrentUser();
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    inFlightMe = null;
    await api.logout();
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // 先に /api/me でセッションを確立してからページを描画する。
    // 通信失敗時も ready=true にして画面が永久に空にならないようにする。
    void (async () => {
      let nextUser: string | null = null;
      try {
        nextUser = await fetchCurrentUser();
      } catch {
        nextUser = null;
      } finally {
        if (!cancelled) {
          setUser(nextUser);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, ready, refreshAuth, logout }),
    [user, ready, refreshAuth, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used inside <AuthProvider>');
  }
  return context;
}

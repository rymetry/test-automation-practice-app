import type { SessionDO } from './session-do';

declare global {
  interface Env {
    /** 訪問者のセッションごとに 1 つの Durable Object。id には `sid` Cookie / `X-Session-Id` ヘッダーの値を使う。 */
    SESSIONS: DurableObjectNamespace<SessionDO>;
    /** ビルド済みのクライアント（index.html、JS、CSS）。 */
    ASSETS: Fetcher;
  }
}

export {};

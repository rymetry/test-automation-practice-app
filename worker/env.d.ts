import type { SessionDO } from './session-do';

declare global {
  interface Env {
    /** One Durable Object per visitor session; the id is the `sid` cookie / `X-Session-Id` header. */
    SESSIONS: DurableObjectNamespace<SessionDO>;
    /** The built client (index.html, JS, CSS). */
    ASSETS: Fetcher;
  }
}

export {};

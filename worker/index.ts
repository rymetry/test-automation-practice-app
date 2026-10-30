import pkg from '../package.json';
import { handleAuth } from './api/auth';
import { handleBilling } from './api/billing';
import { handleBoard } from './api/board';
import { handleContacts } from './api/contacts';
import { handleFiles } from './api/files';
import { handleForms } from './api/forms';
import { type ApiContext, type ApiHandler, json, methodNotAllowed, noContent, notFound } from './api/http';
import { handleMetrics } from './api/metrics';
import { handleTodos } from './api/todos';

export { SessionDO } from './session-do';

const COOKIE_NAME = 'sid';
const COOKIE_MAX_AGE_S = 24 * 60 * 60;
const SESSION_HEADER = 'X-Session-Id';
const SID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Each module answers its own paths; the first non-null response wins. */
const HANDLERS: ApiHandler[] = [
  handleTodos,
  handleAuth,
  handleBilling,
  handleContacts,
  handleBoard,
  handleForms,
  handleFiles,
  handleMetrics,
];

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return json({ ok: true, version: pkg.version });
    }
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  let sid = sidFromRequest(request);
  let issued = false;

  // POST /api/session always starts a fresh session, even when the caller already has one.
  if (url.pathname === '/api/session' && request.method === 'POST') {
    sid = crypto.randomUUID();
    issued = true;
  }
  if (!sid) {
    sid = crypto.randomUUID();
    issued = true;
  }

  const session = env.SESSIONS.get(env.SESSIONS.idFromName(sid));
  const ctx: ApiContext = { request, url, path: url.pathname, method: request.method, session, sid };

  let response: Response;
  try {
    response = await route(ctx);
  } catch (error) {
    console.error('API error', error);
    response = json({ error: 'Internal error' }, 500);
  }

  if (issued) {
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    response.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=${sid}; Path=/; Max-Age=${COOKIE_MAX_AGE_S}; HttpOnly; SameSite=Lax${secure}`,
    );
  }
  return response;
}

async function route(ctx: ApiContext): Promise<Response> {
  if (ctx.path === '/api/session') {
    if (ctx.method !== 'POST') return methodNotAllowed('POST');
    return json({ sid: ctx.sid }, 201);
  }

  if (ctx.path === '/api/reset') {
    if (ctx.method !== 'POST') return methodNotAllowed('POST');
    await ctx.session.reset();
    return noContent();
  }

  for (const handler of HANDLERS) {
    const response = await handler(ctx);
    if (response) return response;
  }
  return notFound();
}

function sidFromRequest(request: Request): string | null {
  const header = request.headers.get(SESSION_HEADER);
  if (header && SID_PATTERN.test(header)) return header;

  const cookie = request.headers.get('Cookie') ?? '';
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) {
      const value = rest.join('=');
      if (SID_PATTERN.test(value)) return value;
    }
  }
  return null;
}

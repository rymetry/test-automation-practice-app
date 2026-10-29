import pkg from '../package.json';
import type { SessionDO } from './session-do';

export { SessionDO } from './session-do';

const COOKIE_NAME = 'sid';
const COOKIE_MAX_AGE_S = 24 * 60 * 60;
const SESSION_HEADER = 'X-Session-Id';
const SID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

type Session = DurableObjectStub<SessionDO>;

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

  let response: Response;
  try {
    response = await route(request, url, session, sid);
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

async function route(request: Request, url: URL, session: Session, sid: string): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/session') {
    if (method !== 'POST') return methodNotAllowed('POST');
    return json({ sid }, 201);
  }

  if (path === '/api/todos') {
    if (method === 'GET') return json(await session.listTodos());
    if (method === 'POST') {
      const body = await readJson(request);
      const title = typeof body?.title === 'string' ? body.title.trim() : '';
      if (!title) return json({ error: 'title is required' }, 400);
      return json(await session.addTodo(title), 201);
    }
    return methodNotAllowed('GET, POST');
  }

  const todoMatch = path.match(/^\/api\/todos\/(\d+)$/);
  if (todoMatch) {
    const id = Number(todoMatch[1]);
    if (method === 'PATCH') {
      const body = await readJson(request);
      if (body === null) return json({ error: 'JSON body is required' }, 400);
      const patch: { title?: string; done?: boolean } = {};
      if ('done' in body) {
        if (typeof body.done !== 'boolean') return json({ error: 'done must be a boolean' }, 400);
        patch.done = body.done;
      }
      if ('title' in body) {
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        if (!title) return json({ error: 'title must be a non-empty string' }, 400);
        patch.title = title;
      }
      const todo = await session.updateTodo(id, patch);
      return todo ? json(todo) : json({ error: 'Not found' }, 404);
    }
    if (method === 'DELETE') {
      const deleted = await session.deleteTodo(id);
      return deleted ? new Response(null, { status: 204 }) : json({ error: 'Not found' }, 404);
    }
    return methodNotAllowed('PATCH, DELETE');
  }

  if (path === '/api/login') {
    if (method !== 'POST') return methodNotAllowed('POST');
    const body = await readJson(request);
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const user = await session.login(username, password);
    return user ? json({ username: user }) : json({ error: 'Invalid username or password' }, 401);
  }

  if (path === '/api/logout') {
    if (method !== 'POST') return methodNotAllowed('POST');
    await session.logout();
    return new Response(null, { status: 204 });
  }

  if (path === '/api/me') {
    if (method !== 'GET') return methodNotAllowed('GET');
    // Always 200: the page asks this on every load, and an anonymous visitor is a normal state, not an error.
    return json({ username: await session.currentUser() });
  }

  if (path === '/api/billing') {
    if (method !== 'GET') return methodNotAllowed('GET');
    if (!(await session.currentUser())) return json({ error: 'Not signed in' }, 401);
    return json({ plan: await session.getPlan() });
  }

  if (path === '/api/billing/upgrade') {
    if (method !== 'POST') return methodNotAllowed('POST');
    if (!(await session.currentUser())) return json({ error: 'Not signed in' }, 401);
    return json({ plan: await session.upgradeToPro() });
  }

  if (path === '/api/reset') {
    if (method !== 'POST') return methodNotAllowed('POST');
    await session.reset();
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
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

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function methodNotAllowed(allow: string): Response {
  const response = json({ error: 'Method not allowed' }, 405);
  response.headers.set('Allow', allow);
  return response;
}

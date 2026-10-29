import { type ApiHandler, badRequest, json, methodNotAllowed, noContent, readJson, str } from './http';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;

export const handleAuth: ApiHandler = async ({ path, method, request, session }) => {
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
    return noContent();
  }

  if (path === '/api/me') {
    if (method !== 'GET') return methodNotAllowed('GET');
    // Always 200: the page asks this on every load, and an anonymous visitor is a normal state, not an error.
    return json({ username: await session.currentUser() });
  }

  if (path === '/api/register') {
    if (method !== 'POST') return methodNotAllowed('POST');
    const body = await readJson(request);
    const fullName = str(body, 'fullName');
    const email = str(body, 'email');
    const username = str(body, 'username');
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!fullName) return badRequest('Full name is required');
    if (!email.includes('@')) return badRequest('Email must contain @');
    if (!USERNAME_PATTERN.test(username)) return badRequest('Username must be 3-20 characters: a-z, 0-9, _');
    if (password.length < MIN_PASSWORD_LENGTH) return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    const user = await session.register({ fullName, email, username, password });
    if (!user) return json({ error: 'Username is already taken' }, 409);
    return json({ username: user.username }, 201);
  }

  if (path === '/api/password/request') {
    if (method !== 'POST') return methodNotAllowed('POST');
    const body = await readJson(request);
    const email = str(body, 'email');
    if (!email) return badRequest('Email is required');
    const token = await session.createPasswordToken(email);
    return token ? json({ token }) : json({ error: 'No account with that email' }, 404);
  }

  if (path === '/api/password/reset') {
    if (method !== 'POST') return methodNotAllowed('POST');
    const body = await readJson(request);
    const token = str(body, 'token');
    const password = typeof body?.password === 'string' ? body.password : '';
    if (password.length < MIN_PASSWORD_LENGTH) return badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    const username = await session.resetPassword(token, password);
    return username ? json({ username }) : badRequest('Invalid or expired token');
  }

  return null;
};

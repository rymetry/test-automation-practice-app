import { type ApiHandler, json, methodNotAllowed } from './http';

export const handleBilling: ApiHandler = async ({ path, method, session }) => {
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

  return null;
};

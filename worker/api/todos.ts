import { type ApiHandler, json, methodNotAllowed, noContent, readJson } from './http';

export const handleTodos: ApiHandler = async ({ path, method, request, session }) => {
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

  const match = path.match(/^\/api\/todos\/(\d+)$/);
  if (!match) return null;

  const id = Number(match[1]);
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
    return deleted ? noContent() : json({ error: 'Not found' }, 404);
  }
  return methodNotAllowed('PATCH, DELETE');
};

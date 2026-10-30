import { COLUMN_IDS, type ColumnId } from '../types';
import { type ApiHandler, badRequest, json, methodNotAllowed, noContent, notFound, readJson, str } from './http';

function isColumn(value: unknown): value is ColumnId {
  return typeof value === 'string' && (COLUMN_IDS as string[]).includes(value);
}

export const handleBoard: ApiHandler = async ({ path, method, request, session }) => {
  if (path === '/api/board') {
    if (method !== 'GET') return methodNotAllowed('GET');
    return json({ cards: await session.listCards() });
  }

  if (path === '/api/board/cards') {
    if (method !== 'POST') return methodNotAllowed('POST');
    const body = await readJson(request);
    const title = str(body, 'title');
    if (!title) return badRequest('title is required');
    const column = body?.column ?? 'todo';
    if (!isColumn(column)) return badRequest(`column must be one of ${COLUMN_IDS.join(', ')}`);
    return json(await session.addCard(title, column), 201);
  }

  const match = path.match(/^\/api\/board\/cards\/(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);

  if (method === 'PATCH') {
    const body = await readJson(request);
    if (body === null) return badRequest('JSON body is required');
    const move: { column?: ColumnId; position?: number } = {};
    if ('column' in body) {
      if (!isColumn(body.column)) return badRequest(`column must be one of ${COLUMN_IDS.join(', ')}`);
      move.column = body.column;
    }
    if ('position' in body) {
      if (typeof body.position !== 'number' || !Number.isInteger(body.position) || body.position < 0) {
        return badRequest('position must be a non-negative integer');
      }
      move.position = body.position;
    }
    const cards = await session.moveCard(id, move);
    return cards ? json({ cards }) : notFound();
  }
  if (method === 'DELETE') {
    return (await session.deleteCard(id)) ? noContent() : notFound();
  }
  return methodNotAllowed('PATCH, DELETE');
};

import type { SessionDO } from '../session-do';

/** Everything an API module needs to answer one request. */
export interface ApiContext {
  request: Request;
  url: URL;
  path: string;
  method: string;
  session: DurableObjectStub<SessionDO>;
  sid: string;
}

/** An API module answers the requests it owns and returns null for every other path. */
export type ApiHandler = (ctx: ApiContext) => Promise<Response | null>;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function notFound(): Response {
  return json({ error: 'Not found' }, 404);
}

export function badRequest(error: string): Response {
  return json({ error }, 400);
}

export function unauthorized(): Response {
  return json({ error: 'Not signed in' }, 401);
}

export function methodNotAllowed(allow: string): Response {
  const response = json({ error: 'Method not allowed' }, 405);
  response.headers.set('Allow', allow);
  return response;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** A trimmed string field, or '' when missing or not a string. */
export function str(body: Record<string, unknown> | null, key: string): string {
  const value = body?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** A download response with the right content type and a file name. */
export function attachment(body: BodyInit, contentType: string, filename: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

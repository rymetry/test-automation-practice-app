import type { SessionDO } from '../session-do';

/** API モジュールが 1 件のリクエストに応答するのに必要なものすべて。 */
export interface ApiContext {
  request: Request;
  url: URL;
  path: string;
  method: string;
  session: DurableObjectStub<SessionDO>;
  sid: string;
}

/** API モジュールは自分が受け持つリクエストに応答し、それ以外のパスには null を返す。 */
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

/** 前後の空白を除いた文字列フィールド。無いときや文字列でないときは ''。 */
export function str(body: Record<string, unknown> | null, key: string): string {
  const value = body?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** 適切な Content-Type とファイル名を付けたダウンロード用のレスポンス。 */
export function attachment(body: BodyInit, contentType: string, filename: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

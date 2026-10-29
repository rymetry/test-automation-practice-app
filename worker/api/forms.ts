import { FORM_IDS, type FormId, type FormValues } from '../types';
import { type ApiHandler, badRequest, json, methodNotAllowed, notFound, readJson } from './http';

export const handleForms: ApiHandler = async ({ path, method, request, session }) => {
  if (path === '/api/forms') {
    if (method !== 'GET') return methodNotAllowed('GET');
    return json(await session.listSubmissions());
  }

  const match = path.match(/^\/api\/forms\/([a-z]+)$/);
  if (!match) return null;
  const form = match[1] as string;
  if (!(FORM_IDS as string[]).includes(form)) return notFound();
  if (method !== 'POST') return methodNotAllowed('POST');

  const body = await readJson(request);
  const raw = body?.values;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return badRequest('values must be an object');
  const values: FormValues = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' || typeof value === 'boolean') values[key] = value;
    else return badRequest(`values.${key} must be a string or a boolean`);
  }
  return json(await session.saveSubmission(form as FormId, values), 201);
};

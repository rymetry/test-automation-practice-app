import type { Contact, ContactInput } from '../types';
import { type ApiHandler, attachment, badRequest, json, methodNotAllowed, noContent, notFound, readJson } from './http';

const MAX_AGE = 150;

/** Validates a full or partial contact. Returns the clean fields, or the first error. */
function parseContact(
  body: Record<string, unknown> | null,
  partial: boolean,
): { ok: true; value: Partial<ContactInput> } | { ok: false; error: string } {
  if (body === null) return { ok: false, error: 'JSON body is required' };
  const value: Partial<ContactInput> = {};
  for (const key of ['firstName', 'lastName', 'username', 'email'] as const) {
    if (key in body || !partial) {
      const text = typeof body[key] === 'string' ? (body[key] as string).trim() : '';
      if (!text) return { ok: false, error: `${key} is required` };
      value[key] = text;
    }
  }
  if ('age' in body || !partial) {
    const age = body.age;
    if (typeof age !== 'number' || !Number.isInteger(age) || age < 0 || age > MAX_AGE) {
      return { ok: false, error: `age must be an integer between 0 and ${MAX_AGE}` };
    }
    value.age = age;
  }
  return { ok: true, value };
}

function csvField(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function contactsCsv(contacts: Contact[]): string {
  const rows = contacts.map((c) =>
    [c.id, c.firstName, c.lastName, c.username, c.email, c.age].map(csvField).join(','),
  );
  return ['id,firstName,lastName,username,email,age', ...rows].join('\n') + '\n';
}

export const handleContacts: ApiHandler = async ({ path, method, request, session }) => {
  if (path === '/api/contacts') {
    if (method === 'GET') return json(await session.listContacts());
    if (method === 'POST') {
      const parsed = parseContact(await readJson(request), false);
      if (!parsed.ok) return badRequest(parsed.error);
      return json(await session.addContact(parsed.value as ContactInput), 201);
    }
    return methodNotAllowed('GET, POST');
  }

  if (path === '/api/contacts.csv') {
    if (method !== 'GET') return methodNotAllowed('GET');
    return attachment(contactsCsv(await session.listContacts()), 'text/csv; charset=utf-8', 'contacts.csv');
  }

  const match = path.match(/^\/api\/contacts\/(\d+)$/);
  if (!match) return null;
  const id = Number(match[1]);

  if (method === 'PATCH') {
    const parsed = parseContact(await readJson(request), true);
    if (!parsed.ok) return badRequest(parsed.error);
    const contact = await session.updateContact(id, parsed.value);
    return contact ? json(contact) : notFound();
  }
  if (method === 'DELETE') {
    return (await session.deleteContact(id)) ? noContent() : notFound();
  }
  return methodNotAllowed('PATCH, DELETE');
};

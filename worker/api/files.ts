import { simplePdf } from '../pdf';
import { type ApiHandler, attachment, badRequest, json, methodNotAllowed, noContent, notFound, unauthorized } from './http';

export const handleFiles: ApiHandler = async ({ path, method, request, session }) => {
  if (path === '/api/files/invoice.pdf') {
    if (method !== 'GET') return methodNotAllowed('GET');
    const username = await session.currentUser();
    if (!username) return unauthorized();
    const [plan, todos] = await Promise.all([session.getPlan(), session.listTodos()]);
    const open = todos.filter((todo) => !todo.done).length;
    const pdf = simplePdf([
      'Invoice',
      `Invoice for ${username}`,
      `Plan: ${plan}`,
      `Open todos: ${open}`,
      `Issued: ${new Date().toISOString().slice(0, 10)}`,
      '',
      'Thank you for practising test automation.',
    ]);
    return attachment(pdf, 'application/pdf', 'invoice.pdf');
  }

  if (path === '/api/files') {
    if (method === 'GET') return json(await session.listFiles());
    if (method === 'POST') {
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return badRequest('multipart/form-data with a "file" field is required');
      }
      const file = form.get('file');
      if (!(file instanceof File)) return badRequest('file is required');
      // Only the name, size and type are kept. The bytes are read and dropped so the session never grows.
      return json(await session.addFile(file.name, file.size, file.type || 'application/octet-stream'), 201);
    }
    return methodNotAllowed('GET, POST');
  }

  const match = path.match(/^\/api\/files\/(\d+)$/);
  if (!match) return null;
  if (method !== 'DELETE') return methodNotAllowed('DELETE');
  return (await session.deleteFile(Number(match[1]))) ? noContent() : notFound();
};

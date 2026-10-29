import type {
  Card,
  ColumnId,
  Contact,
  ContactInput,
  FormId,
  FormSubmission,
  FormValues,
  Metrics,
  Plan,
  RegisterInput,
  Todo,
  UploadedFile,
} from './types';

export type { Plan, Todo } from './types';

export interface Result<T> {
  status: number;
  data: T | null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : null;
  return { status: response.status, data };
}

function post(body: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(body) };
}

function patch(body: unknown): RequestInit {
  return { method: 'PATCH', body: JSON.stringify(body) };
}

export const api = {
  todos: {
    list: () => call<Todo[]>('/api/todos'),
    add: (title: string) => call<Todo>('/api/todos', post({ title })),
    setDone: (id: number, done: boolean) => call<Todo>(`/api/todos/${id}`, patch({ done })),
    remove: (id: number) => call<never>(`/api/todos/${id}`, { method: 'DELETE' }),
  },
  me: () => call<{ username: string | null }>('/api/me'),
  login: (username: string, password: string) => call<{ username: string }>('/api/login', post({ username, password })),
  logout: () => call<never>('/api/logout', { method: 'POST' }),
  register: (input: RegisterInput) => call<{ username: string } | { error: string }>('/api/register', post(input)),
  password: {
    request: (email: string) => call<{ token: string } | { error: string }>('/api/password/request', post({ email })),
    reset: (token: string, password: string) =>
      call<{ username: string } | { error: string }>('/api/password/reset', post({ token, password })),
  },
  billing: () => call<{ plan: Plan }>('/api/billing'),
  upgrade: () => call<{ plan: Plan }>('/api/billing/upgrade', { method: 'POST' }),
  contacts: {
    list: () => call<Contact[]>('/api/contacts'),
    add: (input: ContactInput) => call<Contact | { error: string }>('/api/contacts', post(input)),
    update: (id: number, input: Partial<ContactInput>) => call<Contact | { error: string }>(`/api/contacts/${id}`, patch(input)),
    remove: (id: number) => call<never>(`/api/contacts/${id}`, { method: 'DELETE' }),
  },
  board: {
    get: () => call<{ cards: Card[] }>('/api/board'),
    addCard: (title: string, column: ColumnId) => call<Card>('/api/board/cards', post({ title, column })),
    moveCard: (id: number, move: { column?: ColumnId; position?: number }) =>
      call<{ cards: Card[] }>(`/api/board/cards/${id}`, patch(move)),
    removeCard: (id: number) => call<never>(`/api/board/cards/${id}`, { method: 'DELETE' }),
  },
  forms: {
    list: () => call<FormSubmission[]>('/api/forms'),
    submit: (form: FormId, values: FormValues) => call<FormSubmission>(`/api/forms/${form}`, post({ values })),
  },
  files: {
    list: () => call<UploadedFile[]>('/api/files'),
    upload: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return call<UploadedFile | { error: string }>('/api/files', { method: 'POST', body });
    },
    remove: (id: number) => call<never>(`/api/files/${id}`, { method: 'DELETE' }),
  },
  metrics: () => call<Metrics>('/api/metrics'),
};

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
  PracticeData,
  PracticeDelayResponse,
  PracticeFlakyError,
  PracticeFlakySuccess,
  RegisterInput,
  Todo,
  UploadedFile,
} from './types';

export type { Plan, Todo } from './types';

export interface Result<T> {
  status: number;
  data: T | null;
}

export interface PracticeResult<T> {
  status: number;
  data: T | null;
  invalidJson: boolean;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : null;
  return { status: response.status, data };
}

// Practice ページでは非 JSON・プリミティブ JSON・中断応答のモック差し替えも安全に受け止めるため、
// 例外を投げずにオブジェクト応答だけを data として正規化する専用ヘルパーを使う。
async function callPractice<T>(path: string, init: RequestInit = {}): Promise<PracticeResult<T>> {
  const response = await fetch(path, { ...init, credentials: 'same-origin' });
  const text = await response.text();
  if (!text) return { status: response.status, data: null, invalidJson: false };
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return { status: response.status, data: parsed as T, invalidJson: false };
    }
    return { status: response.status, data: null, invalidJson: true };
  } catch {
    return { status: response.status, data: null, invalidJson: true };
  }
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
  reset: () => call<never>('/api/reset', { method: 'POST' }),
  practice: {
    data: (signal?: AbortSignal) => callPractice<PracticeData | { error: string }>('/api/practice/data', { signal }),
    flaky: (signal?: AbortSignal) =>
      callPractice<PracticeFlakySuccess | PracticeFlakyError | { error: string }>('/api/practice/flaky', { signal }),
    resetFlaky: (signal?: AbortSignal) =>
      callPractice<{ attempts: 0 } | { error: string }>('/api/practice/flaky/reset', { method: 'POST', signal }),
    delay: (ms: number | string, signal?: AbortSignal) =>
      callPractice<PracticeDelayResponse | { error: string }>(
        `/api/practice/delay?ms=${encodeURIComponent(String(ms))}`,
        { signal },
      ),
  },
};

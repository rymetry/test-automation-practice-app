export interface Todo {
  id: number;
  title: string;
  done: boolean;
  createdAt: number;
}

export type Plan = 'Free' | 'Pro';

interface Result<T> {
  status: number;
  data: T | null;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : null;
  return { status: response.status, data };
}

export const api = {
  todos: {
    list: () => call<Todo[]>('/api/todos'),
    add: (title: string) => call<Todo>('/api/todos', { method: 'POST', body: JSON.stringify({ title }) }),
    setDone: (id: number, done: boolean) =>
      call<Todo>(`/api/todos/${id}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
    remove: (id: number) => call<never>(`/api/todos/${id}`, { method: 'DELETE' }),
  },
  me: () => call<{ username: string | null }>('/api/me'),
  login: (username: string, password: string) =>
    call<{ username: string }>('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => call<never>('/api/logout', { method: 'POST' }),
  billing: () => call<{ plan: Plan }>('/api/billing'),
  upgrade: () => call<{ plan: Plan }>('/api/billing/upgrade', { method: 'POST' }),
};

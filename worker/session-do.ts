import { DurableObject } from 'cloudflare:workers';

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  createdAt: number;
}

export type Plan = 'Free' | 'Pro';

/** A session that receives no request for this long deletes itself. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** The only account that can sign in. Public on purpose: this app holds nothing private. */
const SEED_USERS: Record<string, string> = { alice: 'password123' };

type TodoRow = {
  id: number;
  title: string;
  done: number;
  created_at: number;
};

/**
 * All state of one visitor: todos, who is signed in, and the billing plan.
 * Every visitor gets their own object, so two people testing at the same time never see each other's data.
 */
export class SessionDO extends DurableObject<Env> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )`,
    );
    this.sql.exec(`CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  }

  // --- todos ---

  async listTodos(): Promise<Todo[]> {
    await this.touch();
    return this.sql
      .exec<TodoRow>('SELECT id, title, done, created_at FROM todos ORDER BY id')
      .toArray()
      .map(toTodo);
  }

  async addTodo(title: string): Promise<Todo> {
    await this.touch();
    const row = this.sql
      .exec<TodoRow>(
        'INSERT INTO todos (title, done, created_at) VALUES (?, 0, ?) RETURNING id, title, done, created_at',
        title,
        Date.now(),
      )
      .one();
    return toTodo(row);
  }

  async updateTodo(id: number, patch: { title?: string; done?: boolean }): Promise<Todo | null> {
    await this.touch();
    const current = this.sql
      .exec<TodoRow>('SELECT id, title, done, created_at FROM todos WHERE id = ?', id)
      .toArray()[0];
    if (!current) return null;
    const title = patch.title ?? current.title;
    const done = patch.done ?? current.done === 1;
    const row = this.sql
      .exec<TodoRow>(
        'UPDATE todos SET title = ?, done = ? WHERE id = ? RETURNING id, title, done, created_at',
        title,
        done ? 1 : 0,
        id,
      )
      .one();
    return toTodo(row);
  }

  async deleteTodo(id: number): Promise<boolean> {
    await this.touch();
    const deleted = this.sql.exec('DELETE FROM todos WHERE id = ?', id).rowsWritten;
    return deleted > 0;
  }

  // --- sign-in ---

  async login(username: string, password: string): Promise<string | null> {
    await this.touch();
    if (SEED_USERS[username] !== password) return null;
    this.setState('username', username);
    return username;
  }

  async logout(): Promise<void> {
    await this.touch();
    this.sql.exec("DELETE FROM state WHERE key = 'username'");
  }

  async currentUser(): Promise<string | null> {
    await this.touch();
    return this.getState('username');
  }

  // --- billing ---

  async getPlan(): Promise<Plan> {
    await this.touch();
    return (this.getState('plan') as Plan | null) ?? 'Free';
  }

  async upgradeToPro(): Promise<Plan> {
    await this.touch();
    this.setState('plan', 'Pro');
    return 'Pro';
  }

  // --- test support ---

  /** Back to a fresh session: no todos, signed out, Free plan. */
  async reset(): Promise<void> {
    await this.touch();
    this.sql.exec('DELETE FROM todos');
    this.sql.exec('DELETE FROM state');
  }

  // --- lifecycle ---

  /** Fires when the session has been idle for SESSION_TTL_MS: drop everything so nothing lingers. */
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  private async touch(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + SESSION_TTL_MS);
  }

  private getState(key: string): string | null {
    const row = this.sql.exec<{ value: string }>('SELECT value FROM state WHERE key = ?', key).toArray()[0];
    return row?.value ?? null;
  }

  private setState(key: string, value: string): void {
    this.sql.exec('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  }
}

function toTodo(row: TodoRow): Todo {
  return { id: row.id, title: row.title, done: row.done === 1, createdAt: row.created_at };
}

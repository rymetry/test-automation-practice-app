import { DurableObject } from 'cloudflare:workers';
import { SEED_CARDS, SEED_CONTACTS, SEED_USERS } from './seed';
import type {
  Card,
  ColumnId,
  Contact,
  ContactInput,
  FormId,
  FormSubmission,
  FormValues,
  Plan,
  RegisterInput,
  Todo,
  UploadedFile,
  User,
} from './types';

export type { Plan, Todo } from './types';

/** A session that receives no request for this long deletes itself. */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type TodoRow = { id: number; title: string; done: number; created_at: number };
type ContactRow = { id: number; first_name: string; last_name: string; username: string; email: string; age: number };
type CardRow = { id: number; title: string; col: string; position: number };
type UserRow = { username: string; email: string; password: string; full_name: string };
type SubmissionRow = { form: string; values_json: string; submitted_at: number };
type FileRow = { id: number; name: string; size: number; type: string; uploaded_at: number };

/**
 * All state of one visitor: todos, who is signed in, the billing plan, and the data behind the component pages
 * (contacts, board cards, form submissions, registered users, password tokens, uploaded file names).
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
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER NOT NULL
      )`,
    );
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS board_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        col TEXT NOT NULL,
        position INTEGER NOT NULL
      )`,
    );
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL
      )`,
    );
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS password_tokens (
        token TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    );
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS form_submissions (
        form TEXT PRIMARY KEY,
        values_json TEXT NOT NULL,
        submitted_at INTEGER NOT NULL
      )`,
    );
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        size INTEGER NOT NULL,
        type TEXT NOT NULL,
        uploaded_at INTEGER NOT NULL
      )`,
    );
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

  // --- sign-in and accounts ---

  async login(username: string, password: string): Promise<string | null> {
    await this.touch();
    const registered = this.findUser(username);
    const expected = registered ? registered.password : seedUser(username)?.password;
    if (expected === undefined || expected !== password) return null;
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

  /** Creates an account that exists only in this session and signs it in, or says which field is already taken. */
  async register(input: RegisterInput): Promise<User | { taken: 'username' | 'email' }> {
    await this.touch();
    if (seedUser(input.username) || this.findUser(input.username)) return { taken: 'username' };
    if (this.findUsernameByEmail(input.email)) return { taken: 'email' };
    this.sql.exec(
      'INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)',
      input.username,
      input.email,
      input.password,
      input.fullName,
    );
    this.setState('username', input.username);
    return { username: input.username, email: input.email, fullName: input.fullName };
  }

  /** Issues a reset token for the account with this email, or null when no account has it. */
  async createPasswordToken(email: string): Promise<string | null> {
    await this.touch();
    const username = this.findUsernameByEmail(email);
    if (!username) return null;
    const token = crypto.randomUUID();
    this.sql.exec('INSERT INTO password_tokens (token, username, created_at) VALUES (?, ?, ?)', token, username, Date.now());
    return token;
  }

  /** Sets a new password for the token's account and burns the token. Null when the token is unknown. */
  async resetPassword(token: string, password: string): Promise<string | null> {
    await this.touch();
    const row = this.sql.exec<{ username: string }>('SELECT username FROM password_tokens WHERE token = ?', token).toArray()[0];
    if (!row) return null;
    const username = row.username;
    const existing = this.findUser(username);
    const seed = seedUser(username);
    const email = existing?.email ?? seed?.email ?? '';
    const fullName = existing?.full_name ?? seed?.fullName ?? username;
    this.sql.exec(
      `INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET password = excluded.password`,
      username,
      email,
      password,
      fullName,
    );
    this.sql.exec('DELETE FROM password_tokens WHERE token = ?', token);
    return username;
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

  // --- contacts (Smart table) ---

  async listContacts(): Promise<Contact[]> {
    await this.touch();
    this.ensureSeeded();
    return this.sql.exec<ContactRow>('SELECT * FROM contacts ORDER BY id').toArray().map(toContact);
  }

  async addContact(input: ContactInput): Promise<Contact> {
    await this.touch();
    this.ensureSeeded();
    return toContact(this.insertContact(input));
  }

  async updateContact(id: number, patch: Partial<ContactInput>): Promise<Contact | null> {
    await this.touch();
    this.ensureSeeded();
    const current = this.sql.exec<ContactRow>('SELECT * FROM contacts WHERE id = ?', id).toArray()[0];
    if (!current) return null;
    const row = this.sql
      .exec<ContactRow>(
        `UPDATE contacts SET first_name = ?, last_name = ?, username = ?, email = ?, age = ? WHERE id = ? RETURNING *`,
        patch.firstName ?? current.first_name,
        patch.lastName ?? current.last_name,
        patch.username ?? current.username,
        patch.email ?? current.email,
        patch.age ?? current.age,
        id,
      )
      .one();
    return toContact(row);
  }

  async deleteContact(id: number): Promise<boolean> {
    await this.touch();
    this.ensureSeeded();
    return this.sql.exec('DELETE FROM contacts WHERE id = ?', id).rowsWritten > 0;
  }

  // --- board (drag and drop) ---

  async listCards(): Promise<Card[]> {
    await this.touch();
    this.ensureSeeded();
    return this.readCards();
  }

  async addCard(title: string, column: ColumnId): Promise<Card> {
    await this.touch();
    this.ensureSeeded();
    const last = this.sql
      .exec<{ max: number | null }>('SELECT MAX(position) AS max FROM board_cards WHERE col = ?', column)
      .one().max;
    const row = this.sql
      .exec<CardRow>(
        'INSERT INTO board_cards (title, col, position) VALUES (?, ?, ?) RETURNING *',
        title,
        column,
        last === null ? 0 : last + 1,
      )
      .one();
    return toCard(row);
  }

  /** Moves a card to a column and position, renumbering both columns. Returns the whole board, or null when the id is unknown. */
  async moveCard(id: number, move: { column?: ColumnId; position?: number }): Promise<Card[] | null> {
    await this.touch();
    this.ensureSeeded();
    const cards = this.readCards();
    const card = cards.find((c) => c.id === id);
    if (!card) return null;
    const targetColumn = move.column ?? card.column;
    const others = cards.filter((c) => c.id !== id);
    const target = others.filter((c) => c.column === targetColumn);
    const position = Math.min(move.position ?? target.length, target.length);
    target.splice(position, 0, { ...card, column: targetColumn });
    const source = card.column === targetColumn ? [] : others.filter((c) => c.column === card.column);
    for (const list of [target, source]) {
      list.forEach((c, index) => {
        this.sql.exec('UPDATE board_cards SET col = ?, position = ? WHERE id = ?', c.column, index, c.id);
      });
    }
    return this.readCards();
  }

  async deleteCard(id: number): Promise<boolean> {
    await this.touch();
    this.ensureSeeded();
    return this.sql.exec('DELETE FROM board_cards WHERE id = ?', id).rowsWritten > 0;
  }

  // --- form submissions ---

  async listSubmissions(): Promise<FormSubmission[]> {
    await this.touch();
    return this.sql
      .exec<SubmissionRow>('SELECT * FROM form_submissions ORDER BY submitted_at')
      .toArray()
      .map(toSubmission);
  }

  async saveSubmission(form: FormId, values: FormValues): Promise<FormSubmission> {
    await this.touch();
    const row = this.sql
      .exec<SubmissionRow>(
        `INSERT INTO form_submissions (form, values_json, submitted_at) VALUES (?, ?, ?)
         ON CONFLICT(form) DO UPDATE SET values_json = excluded.values_json, submitted_at = excluded.submitted_at
         RETURNING *`,
        form,
        JSON.stringify(values),
        Date.now(),
      )
      .one();
    return toSubmission(row);
  }

  // --- uploaded files (names only) ---

  async listFiles(): Promise<UploadedFile[]> {
    await this.touch();
    return this.sql.exec<FileRow>('SELECT * FROM files ORDER BY id').toArray().map(toFile);
  }

  async addFile(name: string, size: number, type: string): Promise<UploadedFile> {
    await this.touch();
    const row = this.sql
      .exec<FileRow>('INSERT INTO files (name, size, type, uploaded_at) VALUES (?, ?, ?, ?) RETURNING *', name, size, type, Date.now())
      .one();
    return toFile(row);
  }

  async deleteFile(id: number): Promise<boolean> {
    await this.touch();
    return this.sql.exec('DELETE FROM files WHERE id = ?', id).rowsWritten > 0;
  }

  // --- test support ---

  /** Back to a fresh session: no todos, signed out, Free plan, seeded contacts and cards, no accounts or files. */
  async reset(): Promise<void> {
    await this.touch();
    for (const table of ['todos', 'state', 'contacts', 'board_cards', 'users', 'password_tokens', 'form_submissions', 'files']) {
      this.sql.exec(`DELETE FROM ${table}`);
    }
    // The seeded tables restart their ids so a reset session looks like a new one. Todo ids keep counting up, as they always did.
    this.sql.exec("DELETE FROM sqlite_sequence WHERE name IN ('contacts', 'board_cards', 'files')");
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

  /** Inserts the seed contacts and cards once per session (and again after a reset). */
  private ensureSeeded(): void {
    if (this.getState('seeded') === '1') return;
    for (const contact of SEED_CONTACTS) this.insertContact(contact);
    const positions: Record<string, number> = {};
    for (const card of SEED_CARDS) {
      const position = positions[card.column] ?? 0;
      positions[card.column] = position + 1;
      this.sql.exec('INSERT INTO board_cards (title, col, position) VALUES (?, ?, ?)', card.title, card.column, position);
    }
    this.setState('seeded', '1');
  }

  private insertContact(input: ContactInput): ContactRow {
    return this.sql
      .exec<ContactRow>(
        'INSERT INTO contacts (first_name, last_name, username, email, age) VALUES (?, ?, ?, ?, ?) RETURNING *',
        input.firstName,
        input.lastName,
        input.username,
        input.email,
        input.age,
      )
      .one();
  }

  private readCards(): Card[] {
    return this.sql
      .exec<CardRow>("SELECT * FROM board_cards ORDER BY CASE col WHEN 'todo' THEN 0 WHEN 'doing' THEN 1 ELSE 2 END, position, id")
      .toArray()
      .map(toCard);
  }

  private findUser(username: string): UserRow | undefined {
    return this.sql.exec<UserRow>('SELECT * FROM users WHERE username = ?', username).toArray()[0];
  }

  /** The account (registered or seeded) that has this email, ignoring case. */
  private findUsernameByEmail(email: string): string | null {
    const wanted = email.toLowerCase();
    const row = this.sql.exec<UserRow>('SELECT * FROM users WHERE lower(email) = ?', wanted).toArray()[0];
    if (row) return row.username;
    for (const [name, seed] of Object.entries(SEED_USERS)) {
      if (seed.email.toLowerCase() === wanted) return name;
    }
    return null;
  }

  private getState(key: string): string | null {
    const row = this.sql.exec<{ value: string }>('SELECT value FROM state WHERE key = ?', key).toArray()[0];
    return row?.value ?? null;
  }

  private setState(key: string, value: string): void {
    this.sql.exec('INSERT INTO state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
  }
}

/** Own keys only: "constructor" is a valid username, not a seeded account. */
function seedUser(username: string): (typeof SEED_USERS)[string] | undefined {
  return Object.hasOwn(SEED_USERS, username) ? SEED_USERS[username] : undefined;
}

function toTodo(row: TodoRow): Todo {
  return { id: row.id, title: row.title, done: row.done === 1, createdAt: row.created_at };
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    email: row.email,
    age: row.age,
  };
}

function toCard(row: CardRow): Card {
  return { id: row.id, title: row.title, column: row.col as ColumnId, position: row.position };
}

function toSubmission(row: SubmissionRow): FormSubmission {
  return { form: row.form as FormId, values: JSON.parse(row.values_json) as FormValues, submittedAt: row.submitted_at };
}

function toFile(row: FileRow): UploadedFile {
  return { id: row.id, name: row.name, size: row.size, type: row.type, uploadedAt: row.uploaded_at };
}

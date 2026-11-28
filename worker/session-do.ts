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

/** この期間リクエストが無いセッションは自分自身を削除する。 */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const FLAKY_ATTEMPTS_KEY = 'practice_flaky_attempts';

type TodoRow = { id: number; title: string; done: number; created_at: number };
type ContactRow = { id: number; first_name: string; last_name: string; username: string; email: string; age: number };
type CardRow = { id: number; title: string; col: string; position: number };
type UserRow = { username: string; email: string; password: string; full_name: string };
type SubmissionRow = { form: string; values_json: string; submitted_at: number };
type FileRow = { id: number; name: string; size: number; type: string; uploaded_at: number };

/**
 * 訪問者 1 人分の全状態。todo、サインイン中のユーザー、課金プラン、部品ページと練習ページのデータ
 * （連絡先、ボードのカード、フォーム送信、登録ユーザー、パスワード再設定トークン、アップロードしたファイル名、Flaky API の試行回数）を持つ。
 * 訪問者ごとに別のオブジェクトを使うので、同時にテストしている 2 人が互いのデータを見ることはない。
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

  // --- todo ---

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

  // --- サインインとアカウント ---

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

  /** このセッションにだけ存在するアカウントを作ってサインインさせる。既に使われている項目があれば、どの項目かを返す。 */
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

  /** このメールアドレスのアカウントにリセット用トークンを発行する。該当するアカウントが無ければ null。 */
  async createPasswordToken(email: string): Promise<string | null> {
    await this.touch();
    const username = this.findUsernameByEmail(email);
    if (!username) return null;
    const token = crypto.randomUUID();
    this.sql.exec('INSERT INTO password_tokens (token, username, created_at) VALUES (?, ?, ?)', token, username, Date.now());
    return token;
  }

  /** トークンのアカウントに新しいパスワードを設定し、トークンを使用済みにする。未知のトークンなら null。 */
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

  // --- 課金プラン ---

  async getPlan(): Promise<Plan> {
    await this.touch();
    return (this.getState('plan') as Plan | null) ?? 'Free';
  }

  async upgradeToPro(): Promise<Plan> {
    await this.touch();
    this.setState('plan', 'Pro');
    return 'Pro';
  }

  // --- 連絡先（Smart table） ---

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

  // --- ボード（ドラッグ＆ドロップ） ---

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

  /** カードを指定の列と位置へ移し、移動元と移動先の列を採番し直す。ボード全体を返し、id が未知なら null。 */
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

  // --- フォーム送信 ---

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

  // --- アップロードしたファイル（名前のみ） ---

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

  // --- 練習ページ ---

  async nextFlakyAttempt(): Promise<number> {
    await this.touch();
    const raw = this.getState(FLAKY_ATTEMPTS_KEY);
    const prev = raw !== null && /^\d+$/.test(raw) ? Number(raw) : 0;
    const next = prev + 1;
    this.setState(FLAKY_ATTEMPTS_KEY, String(next));
    return next;
  }

  async resetFlakyAttempts(): Promise<void> {
    await this.touch();
    this.sql.exec('DELETE FROM state WHERE key = ?', FLAKY_ATTEMPTS_KEY);
  }

  // --- テスト支援 ---

  /** 新しいセッションの状態に戻す。todo なし、未サインイン、Free プラン、連絡先とカードはシード済み、アカウント・ファイル・Flaky API の試行回数なし。 */
  async reset(): Promise<void> {
    await this.touch();
    for (const table of ['todos', 'state', 'contacts', 'board_cards', 'users', 'password_tokens', 'form_submissions', 'files']) {
      this.sql.exec(`DELETE FROM ${table}`);
    }
    // シードするテーブルは id を 1 から振り直し、リセット後も新しいセッションと同じに見せる。todo の id は従来どおり続き番号にする。
    this.sql.exec("DELETE FROM sqlite_sequence WHERE name IN ('contacts', 'board_cards', 'files')");
  }

  // --- ライフサイクル ---

  /** SESSION_TTL_MS のあいだ使われなかったときに発火する。何も残らないようすべて消す。 */
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  private async touch(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + SESSION_TTL_MS);
  }

  /** 連絡先とカードのシードをセッションごとに 1 回（リセット後にもう 1 回）入れる。 */
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

  /** このメールアドレスを持つアカウント（登録済みまたはシード）。大文字小文字は区別しない。 */
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

/** 自身のキーだけを見る。"constructor" はシードのアカウントではなく、有効なユーザー名として扱う。 */
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

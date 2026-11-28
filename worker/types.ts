/** Worker、Durable Object、クライアントが共有する型（src/types.ts が再エクスポートする）。 */

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  createdAt: number;
}

export type Plan = 'Free' | 'Pro';

export interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  age: number;
}

export type ContactInput = Omit<Contact, 'id'>;

export type ColumnId = 'todo' | 'doing' | 'done';

export const COLUMN_IDS: ColumnId[] = ['todo', 'doing', 'done'];

export const COLUMN_NAMES: Record<ColumnId, string> = { todo: 'To do', doing: 'In progress', done: 'Done' };

export interface Card {
  id: number;
  title: string;
  column: ColumnId;
  position: number;
}

export type FormId = 'inline' | 'grid' | 'basic' | 'block' | 'horizontal';

export const FORM_IDS: FormId[] = ['inline', 'grid', 'basic', 'block', 'horizontal'];

export type FormValues = Record<string, string | boolean>;

export interface FormSubmission {
  form: FormId;
  values: FormValues;
  submittedAt: number;
}

export interface UploadedFile {
  id: number;
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
}

export interface Metrics {
  contactsByAgeGroup: { group: string; count: number }[];
  cardsByColumn: { column: ColumnId; name: string; count: number }[];
}

export interface RegisterInput {
  fullName: string;
  email: string;
  username: string;
  password: string;
}

export interface User {
  username: string;
  email: string;
  fullName: string;
}

export const PRACTICE_DEFAULT_DELAY_MS = 1000;
export const PRACTICE_MAX_DELAY_MS = 5000;

export interface PracticeData {
  message: string;
  items: string[];
}

export interface PracticeFlakySuccess {
  message: string;
  attempt: number;
}

export interface PracticeFlakyError {
  error: string;
  attempt: number;
}

export interface PracticeDelayResponse {
  delayMs: number;
  message: string;
}

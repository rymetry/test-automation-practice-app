import type { ColumnId, ContactInput } from './types';

/** The only account that exists in every session. Public on purpose: this app holds nothing private. */
export const SEED_USERS: Record<string, { password: string; email: string; fullName: string }> = {
  alice: { password: 'password123', email: 'alice@example.com', fullName: 'Alice Example' },
};

/** 12 contacts: two pages of 10 in the Smart table. All fictional. */
export const SEED_CONTACTS: ContactInput[] = [
  { firstName: 'Mark', lastName: 'Otto', username: '@mdo', email: 'mdo@gmail.com', age: 28 },
  { firstName: 'Jacob', lastName: 'Thornton', username: '@fat', email: 'fat@yandex.ru', age: 45 },
  { firstName: 'Larry', lastName: 'Bird', username: '@twitter', email: 'twitter@outlook.com', age: 18 },
  { firstName: 'John', lastName: 'Snow', username: '@snow', email: 'snow@gmail.com', age: 20 },
  { firstName: 'Jack', lastName: 'Sparrow', username: '@jack', email: 'jack@yandex.ru', age: 30 },
  { firstName: 'Ann', lastName: 'Smith', username: '@ann', email: 'ann@gmail.com', age: 21 },
  { firstName: 'Barbara', lastName: 'Black', username: '@barbara', email: 'barbara@yandex.ru', age: 43 },
  { firstName: 'Sevan', lastName: 'Bagrat', username: '@sevan', email: 'sevan@outlook.com', age: 13 },
  { firstName: 'Ruben', lastName: 'Vardan', username: '@ruben', email: 'ruben@gmail.com', age: 22 },
  { firstName: 'Karen', lastName: 'Fedor', username: '@karen', email: 'karen@yandex.ru', age: 55 },
  { firstName: 'Sofia', lastName: 'Gerald', username: '@sofia', email: 'sofia@outlook.com', age: 36 },
  { firstName: 'Hiroshi', lastName: 'Tanaka', username: '@hiroshi', email: 'hiroshi@example.com', age: 61 },
];

/** 6 cards across the three Board columns, in display order. */
export const SEED_CARDS: { title: string; column: ColumnId }[] = [
  { title: 'Write the release notes', column: 'todo' },
  { title: 'Design the sign-up page', column: 'todo' },
  { title: 'Fix the login timeout', column: 'todo' },
  { title: 'Review pull request 42', column: 'doing' },
  { title: 'Update the dependencies', column: 'doing' },
  { title: 'Set up the CI pipeline', column: 'done' },
];

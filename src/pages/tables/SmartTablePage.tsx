import { useEffect, useRef, useState, type JSX, type RefObject } from 'react';
import { api } from '../../api';
import type { Page } from '../../router';
import type { Contact, ContactInput } from '../../types';
import { mountReact } from '../../ui/mount-react';
import { PageLayout } from '../../ui/PageLayout';

type Key = keyof Contact;
type Editing = { kind: 'none' } | { kind: 'new' } | { kind: 'row'; id: number };

interface SortState {
  key: Key;
  direction: 'ascending' | 'descending';
}

interface DraftContact {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  age: string;
}

const COLUMNS: { key: Key; label: string; numeric?: boolean }[] = [
  { key: 'id', label: 'ID', numeric: true },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'username', label: 'Username' },
  { key: 'email', label: 'Email' },
  { key: 'age', label: 'Age', numeric: true },
];
const PAGE_SIZE = 10;

function emptyDraft(): DraftContact {
  return { firstName: '', lastName: '', username: '', email: '', age: '' };
}

function computeVisibleContacts(
  contacts: Contact[],
  filters: Partial<Record<Key, string>>,
  sort: SortState | null,
): Contact[] {
  let rows = contacts.filter((contact) =>
    COLUMNS.every((column) => {
      const wanted = (filters[column.key] ?? '').toLowerCase();
      return !wanted || String(contact[column.key]).toLowerCase().includes(wanted);
    }),
  );
  if (sort) {
    const { key, direction } = sort;
    const sign = direction === 'ascending' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const left = a[key];
      const right = b[key];
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * sign;
      return String(left).localeCompare(String(right)) * sign;
    });
  }
  return rows;
}

interface EditorRowProps {
  mode: 'new' | 'edit';
  id?: number;
  draft: DraftContact;
  firstNameInputRef?: RefObject<HTMLInputElement | null>;
  onChange: (field: keyof DraftContact, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditorRow({ mode, id, draft, firstNameInputRef, onChange, onSave, onCancel }: EditorRowProps): JSX.Element {
  return (
    <tr data-testid={mode === 'new' ? 'new-contact-row' : 'edit-contact-row'} className="editing">
      <td className="num">{id ?? ''}</td>
      <td>
        <input
          ref={firstNameInputRef}
          type="text"
          aria-label="First name"
          name="firstName"
          value={draft.firstName}
          onChange={(event) => onChange('firstName', event.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          aria-label="Last name"
          name="lastName"
          value={draft.lastName}
          onChange={(event) => onChange('lastName', event.target.value)}
        />
      </td>
      <td>
        <input
          type="text"
          aria-label="Username"
          name="username"
          value={draft.username}
          onChange={(event) => onChange('username', event.target.value)}
        />
      </td>
      <td>
        <input
          type="email"
          aria-label="Email"
          name="email"
          value={draft.email}
          onChange={(event) => onChange('email', event.target.value)}
        />
      </td>
      <td>
        <input
          type="number"
          aria-label="Age"
          name="age"
          min="0"
          max="150"
          value={draft.age}
          onChange={(event) => onChange('age', event.target.value)}
        />
      </td>
      <td>
        <div className="row table-actions">
          <button type="button" className="btn-primary btn-sm" data-action="save" onClick={onSave}>
            {mode === 'new' ? 'Create' : 'Save'}
          </button>
          <button type="button" className="btn-sm" data-action="cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

/** 絞り込み・並べ替え・インライン追加／編集・削除確認・ページネーションを備えた連絡先テーブル。 */
export function SmartTablePage(): JSX.Element | null {
  const [loaded, setLoaded] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filters, setFilters] = useState<Partial<Record<Key, string>>>({});
  const [sort, setSort] = useState<SortState | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [editing, setEditing] = useState<Editing>({ kind: 'none' });
  const [draft, setDraft] = useState<DraftContact>(() => emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);
  const [addNewFocusTick, setAddNewFocusTick] = useState(0);

  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const pendingDeleteRef = useRef<Contact | null>(null);
  const newFirstNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void api.contacts.list().then((initial) => {
      if (cancelled) return;
      setContacts(initial.data ?? []);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editing.kind === 'new' && addNewFocusTick > 0) {
      newFirstNameRef.current?.focus();
    }
  }, [editing.kind, addNewFocusTick]);

  if (!loaded) return null;

  const rows = computeVisibleContacts(contacts, filters, sort);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const clampedPageIndex = Math.min(pageIndex, pageCount - 1);
  const start = clampedPageIndex * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  const handleSort = (key: Key): void => {
    const current = sort?.key === key ? sort.direction : 'none';
    const nextDirection = current === 'none' ? 'ascending' : current === 'ascending' ? 'descending' : null;
    setSort(nextDirection ? { key, direction: nextDirection } : null);
  };

  const handleFilterChange = (key: Key, value: string): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPageIndex(0);
  };

  const handleClearFilters = (): void => {
    setFilters({});
    setPageIndex(0);
  };

  const handleAddNew = (): void => {
    setEditing({ kind: 'new' });
    setDraft(emptyDraft());
    setPageIndex(0);
    setAddNewFocusTick((tick) => tick + 1);
  };

  const handleStartEdit = (contact: Contact): void => {
    setEditing({ kind: 'row', id: contact.id });
    setDraft({
      firstName: contact.firstName,
      lastName: contact.lastName,
      username: contact.username,
      email: contact.email,
      age: String(contact.age),
    });
  };

  const handleCancelEdit = (): void => {
    setEditing({ kind: 'none' });
    setError(null);
  };

  const handleDraftChange = (field: keyof DraftContact, value: string): void => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (target: { mode: 'new' } | { mode: 'edit'; id: number }): Promise<void> => {
    const ageText = draft.age.trim();
    if (!ageText) {
      setError('Age is required');
      return;
    }
    const input: ContactInput = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      username: draft.username.trim(),
      email: draft.email.trim(),
      age: Number(ageText),
    };
    const result =
      target.mode === 'new' ? await api.contacts.add(input) : await api.contacts.update(target.id, input);
    if ((result.status === 201 || result.status === 200) && result.data && 'id' in result.data) {
      const saved = result.data;
      const nextContacts =
        target.mode === 'new' ? [...contacts, saved] : contacts.map((c) => (c.id === saved.id ? saved : c));
      setContacts(nextContacts);
      setEditing({ kind: 'none' });
      setError(null);
      // 保存した行があるページへ移動し、新規 11 件目が 2 ページ目に隠れて見えない状態を防ぐ。
      const index = computeVisibleContacts(nextContacts, filters, sort).findIndex((c) => c.id === saved.id);
      if (index >= 0) setPageIndex(Math.floor(index / PAGE_SIZE));
    } else {
      setError(result.data && 'error' in result.data ? result.data.error : 'Could not save the contact');
    }
  };

  const handleOpenDelete = (contact: Contact): void => {
    pendingDeleteRef.current = contact;
    setPendingDelete(contact);
    deleteDialogRef.current?.showModal();
  };

  const handleConfirmDelete = async (): Promise<void> => {
    const target = pendingDeleteRef.current;
    if (!target) return;
    // 削除通信中の多重クリックを無視するため即時クリアする。
    pendingDeleteRef.current = null;
    const result = await api.contacts.remove(target.id);
    if (result.status === 204) {
      setContacts((prev) => prev.filter((c) => c.id !== target.id));
    } else {
      setError('Could not delete the contact');
    }
    deleteDialogRef.current?.close();
  };

  return (
    <PageLayout
      title="Smart table"
      intro='連絡先の表です。列見出しで並べ替え、2 行目の入力欄で絞り込み、"Add new" で先頭に追加行、各行の "Edit" / "Delete" で編集と削除ができます。行は row ロールなので、filter({ hasText }) で 1 行を選んでからその中のボタンを押します。データは API と同じものです。'
    >
      <div className="row" style={{ marginBottom: 'var(--space-3)' }}>
        <button type="button" className="btn-primary" data-testid="add-new" onClick={handleAddNew}>
          Add new
        </button>
        <button type="button" data-testid="clear-filters" onClick={handleClearFilters}>
          Clear filters
        </button>
      </div>
      <div data-testid="contact-error">
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
      </div>
      <div className="table-wrap">
        <table aria-label="Contacts" data-testid="contacts">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.numeric ? 'num' : undefined}
                  aria-sort={sort?.key === column.key ? sort.direction : 'none'}
                  data-key={column.key}
                >
                  <button
                    type="button"
                    className="sort-button"
                    aria-label={`Sort by ${column.label}`}
                    onClick={() => handleSort(column.key)}
                  >
                    {column.label}
                  </button>
                </th>
              ))}
              <th scope="col">Actions</th>
            </tr>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.key}>
                  <input
                    type="text"
                    aria-label={`Filter by ${column.label}`}
                    data-filter={column.key}
                    autoComplete="off"
                    value={filters[column.key] ?? ''}
                    onChange={(event) => handleFilterChange(column.key, event.target.value)}
                  />
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {editing.kind === 'new' ? (
              <EditorRow
                mode="new"
                draft={draft}
                firstNameInputRef={newFirstNameRef}
                onChange={handleDraftChange}
                onSave={() => {
                  void handleSave({ mode: 'new' });
                }}
                onCancel={handleCancelEdit}
              />
            ) : null}
            {slice.map((contact) =>
              editing.kind === 'row' && editing.id === contact.id ? (
                <EditorRow
                  key={contact.id}
                  mode="edit"
                  id={contact.id}
                  draft={draft}
                  onChange={handleDraftChange}
                  onSave={() => {
                    void handleSave({ mode: 'edit', id: contact.id });
                  }}
                  onCancel={handleCancelEdit}
                />
              ) : (
                <tr key={contact.id} data-testid="contact-row" data-id={contact.id}>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className={column.numeric ? 'num' : undefined}>
                      {String(contact[column.key])}
                    </td>
                  ))}
                  <td>
                    <div className="row table-actions">
                      <button
                        type="button"
                        className="btn-sm"
                        data-action="edit"
                        onClick={() => handleStartEdit(contact)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-sm"
                        data-action="delete"
                        onClick={() => handleOpenDelete(contact)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {rows.length === 0 && editing.kind !== 'new' ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="muted">
                  No contacts match the filters
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <p className="muted" data-testid="page-summary">
          {rows.length === 0 ? 'Showing 0 of 0' : `Showing ${start + 1}–${start + slice.length} of ${rows.length}`}
        </p>
        <nav aria-label="Pagination" className="pagination">
          <button
            type="button"
            className="btn-sm"
            aria-label="Previous page"
            disabled={clampedPageIndex === 0}
            onClick={() => setPageIndex(clampedPageIndex - 1)}
          >
            ‹
          </button>
          {Array.from({ length: pageCount }, (_, index) => (
            <button
              key={index}
              type="button"
              className="btn-sm"
              aria-label={`Page ${index + 1}`}
              aria-current={index === clampedPageIndex ? 'page' : undefined}
              onClick={() => setPageIndex(index)}
            >
              {index + 1}
            </button>
          ))}
          <button
            type="button"
            className="btn-sm"
            aria-label="Next page"
            disabled={clampedPageIndex >= pageCount - 1}
            onClick={() => setPageIndex(clampedPageIndex + 1)}
          >
            ›
          </button>
        </nav>
      </div>

      <dialog
        ref={deleteDialogRef}
        aria-labelledby="delete-contact-title"
        data-testid="delete-dialog"
        onClose={() => {
          pendingDeleteRef.current = null;
        }}
      >
        <h2 id="delete-contact-title">Delete this contact?</h2>
        <p data-testid="delete-target">
          {pendingDelete ? `${pendingDelete.firstName} ${pendingDelete.lastName} (${pendingDelete.email})` : null}
        </p>
        <div className="row">
          <button
            type="button"
            className="btn-danger"
            data-testid="confirm-delete"
            onClick={() => {
              void handleConfirmDelete();
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            data-testid="cancel-delete"
            onClick={() => {
              pendingDeleteRef.current = null;
              deleteDialogRef.current?.close();
            }}
          >
            Cancel
          </button>
        </div>
      </dialog>
    </PageLayout>
  );
}

export const smartTablePage: Page = mountReact(SmartTablePage);

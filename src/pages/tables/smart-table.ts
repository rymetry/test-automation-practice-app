import { api } from '../../api';
import { esc, html, q } from '../../dom';
import type { Page } from '../../router';
import type { Contact, ContactInput } from '../../types';
import { page } from '../../ui/page';

type Key = keyof Contact;
type Editing = { kind: 'none' } | { kind: 'new' } | { kind: 'row'; id: number };

const COLUMNS: { key: Key; label: string; numeric?: boolean }[] = [
  { key: 'id', label: 'ID', numeric: true },
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'username', label: 'Username' },
  { key: 'email', label: 'Email' },
  { key: 'age', label: 'Age', numeric: true },
];
const PAGE_SIZE = 10;

/** A contacts table with filters, sorting, inline add / edit, delete with confirmation, and pagination. */
export const smartTablePage: Page = async (root) => {
  const initial = await api.contacts.list();
  let contacts: Contact[] = initial.data ?? [];
  const filters: Partial<Record<Key, string>> = {};
  let sort: { key: Key; direction: 'ascending' | 'descending' } | null = null;
  let pageIndex = 0;
  let editing: Editing = { kind: 'none' };

  const view = page(
    'Smart table',
    '連絡先の表です。列見出しで並べ替え、2 行目の入力欄で絞り込み、"Add new" で先頭に追加行、各行の "Edit" / "Delete" で編集と削除ができます。行は row ロールなので、filter({ hasText }) で 1 行を選んでからその中のボタンを押します。データは API と同じものです。',
    `
      <div class="row" style="margin-bottom: var(--space-3)">
        <button type="button" class="btn-primary" data-testid="add-new">Add new</button>
        <button type="button" data-testid="clear-filters">Clear filters</button>
      </div>
      <div data-testid="contact-error"></div>
      <div class="table-wrap">
        <table aria-label="Contacts" data-testid="contacts">
          <thead>
            <tr>
              ${COLUMNS.map(
                (column) => `
                  <th scope="col" aria-sort="none" data-key="${column.key}">
                    <button type="button" class="sort-button" aria-label="Sort by ${esc(column.label)}">${esc(column.label)}</button>
                  </th>
                `,
              ).join('')}
              <th scope="col">Actions</th>
            </tr>
            <tr>
              ${COLUMNS.map(
                (column) => `
                  <th><input type="text" aria-label="Filter by ${esc(column.label)}" data-filter="${column.key}" autocomplete="off" /></th>
                `,
              ).join('')}
              <th></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      <p class="muted" data-testid="page-summary"></p>
      <nav aria-label="Pagination" class="pagination"></nav>

      <dialog aria-labelledby="delete-contact-title" data-testid="delete-dialog">
        <h2 id="delete-contact-title">Delete this contact?</h2>
        <p data-testid="delete-target"></p>
        <div class="row">
          <button type="button" class="btn-danger" data-testid="confirm-delete">Confirm</button>
          <button type="button" data-testid="cancel-delete">Cancel</button>
        </div>
      </dialog>
    `,
  );
  root.append(view);

  const tbody = q<HTMLTableSectionElement>(view, 'tbody');
  const summary = q(view, '[data-testid="page-summary"]');
  const pagination = q(view, 'nav.pagination');
  const errorBox = q(view, '[data-testid="contact-error"]');
  const deleteDialog = q<HTMLDialogElement>(view, '[data-testid="delete-dialog"]');
  let pendingDelete: Contact | null = null;

  function showError(message: string | null): void {
    errorBox.innerHTML = '';
    if (message) errorBox.append(html(`<p role="alert" class="error">${esc(message)}</p>`));
  }

  function visibleContacts(): Contact[] {
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

  function editorRow(contact: Partial<Contact>, mode: 'new' | 'edit'): HTMLTableRowElement {
    const row = html<HTMLTableRowElement>(`
      <tr data-testid="${mode === 'new' ? 'new-contact-row' : 'edit-contact-row'}" class="editing">
        <td>${contact.id ?? ''}</td>
        <td><input type="text" aria-label="First name" name="firstName" value="${esc(contact.firstName ?? '')}" /></td>
        <td><input type="text" aria-label="Last name" name="lastName" value="${esc(contact.lastName ?? '')}" /></td>
        <td><input type="text" aria-label="Username" name="username" value="${esc(contact.username ?? '')}" /></td>
        <td><input type="email" aria-label="Email" name="email" value="${esc(contact.email ?? '')}" /></td>
        <td><input type="number" aria-label="Age" name="age" min="0" max="150" value="${contact.age ?? ''}" /></td>
        <td class="row">
          <button type="button" class="btn-primary btn-sm" data-action="save">${mode === 'new' ? 'Create' : 'Save'}</button>
          <button type="button" class="btn-sm" data-action="cancel">Cancel</button>
        </td>
      </tr>
    `);
    q(row, '[data-action="cancel"]').addEventListener('click', () => {
      editing = { kind: 'none' };
      showError(null);
      draw();
    });
    q(row, '[data-action="save"]').addEventListener('click', async () => {
      const ageText = q<HTMLInputElement>(row, '[name="age"]').value.trim();
      if (!ageText) {
        showError('Age is required');
        return;
      }
      const input: ContactInput = {
        firstName: q<HTMLInputElement>(row, '[name="firstName"]').value.trim(),
        lastName: q<HTMLInputElement>(row, '[name="lastName"]').value.trim(),
        username: q<HTMLInputElement>(row, '[name="username"]').value.trim(),
        email: q<HTMLInputElement>(row, '[name="email"]').value.trim(),
        age: Number(ageText),
      };
      const result = mode === 'new' ? await api.contacts.add(input) : await api.contacts.update(contact.id!, input);
      if ((result.status === 201 || result.status === 200) && result.data && 'id' in result.data) {
        const saved = result.data;
        contacts = mode === 'new' ? [...contacts, saved] : contacts.map((c) => (c.id === saved.id ? saved : c));
        editing = { kind: 'none' };
        showError(null);
        // Show the page that holds the saved row, so a new 11th contact does not vanish onto page 2 unseen.
        const index = visibleContacts().findIndex((c) => c.id === saved.id);
        if (index >= 0) pageIndex = Math.floor(index / PAGE_SIZE);
      } else {
        showError(result.data && 'error' in result.data ? result.data.error : 'Could not save the contact');
      }
      draw();
    });
    return row;
  }

  function displayRow(contact: Contact): HTMLTableRowElement {
    const row = html<HTMLTableRowElement>(`
      <tr data-testid="contact-row" data-id="${contact.id}">
        ${COLUMNS.map((column) => `<td>${esc(String(contact[column.key]))}</td>`).join('')}
        <td class="row">
          <button type="button" class="btn-sm" data-action="edit">Edit</button>
          <button type="button" class="btn-sm" data-action="delete">Delete</button>
        </td>
      </tr>
    `);
    q(row, '[data-action="edit"]').addEventListener('click', () => {
      editing = { kind: 'row', id: contact.id };
      draw();
    });
    q(row, '[data-action="delete"]').addEventListener('click', () => {
      pendingDelete = contact;
      q(deleteDialog, '[data-testid="delete-target"]').textContent = `${contact.firstName} ${contact.lastName} (${contact.email})`;
      deleteDialog.showModal();
    });
    return row;
  }

  function draw(): void {
    const rows = visibleContacts();
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    pageIndex = Math.min(pageIndex, pageCount - 1);
    const start = pageIndex * PAGE_SIZE;
    const slice = rows.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = '';
    if (editing.kind === 'new') tbody.append(editorRow({}, 'new'));
    for (const contact of slice) {
      tbody.append(editing.kind === 'row' && editing.id === contact.id ? editorRow(contact, 'edit') : displayRow(contact));
    }
    if (rows.length === 0 && editing.kind !== 'new') {
      tbody.append(html(`<tr><td colspan="${COLUMNS.length + 1}" class="muted">No contacts match the filters</td></tr>`));
    }

    summary.textContent =
      rows.length === 0 ? 'Showing 0 of 0' : `Showing ${start + 1}–${start + slice.length} of ${rows.length}`;

    pagination.innerHTML = '';
    const previous = html<HTMLButtonElement>('<button type="button" class="btn-sm" aria-label="Previous page">‹</button>');
    previous.disabled = pageIndex === 0;
    previous.addEventListener('click', () => {
      pageIndex -= 1;
      draw();
    });
    pagination.append(previous);
    for (let index = 0; index < pageCount; index++) {
      const button = html<HTMLButtonElement>(`<button type="button" class="btn-sm" aria-label="Page ${index + 1}">${index + 1}</button>`);
      if (index === pageIndex) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => {
        pageIndex = index;
        draw();
      });
      pagination.append(button);
    }
    const next = html<HTMLButtonElement>('<button type="button" class="btn-sm" aria-label="Next page">›</button>');
    next.disabled = pageIndex >= pageCount - 1;
    next.addEventListener('click', () => {
      pageIndex += 1;
      draw();
    });
    pagination.append(next);
  }

  // Sorting: click cycles none → ascending → descending → none, one column at a time.
  for (const th of view.querySelectorAll<HTMLTableCellElement>('th[data-key]')) {
    const key = th.dataset.key as Key;
    q(th, 'button').addEventListener('click', () => {
      const current = sort?.key === key ? sort.direction : 'none';
      const nextDirection = current === 'none' ? 'ascending' : current === 'ascending' ? 'descending' : null;
      sort = nextDirection ? { key, direction: nextDirection } : null;
      for (const other of view.querySelectorAll<HTMLTableCellElement>('th[data-key]')) {
        other.setAttribute('aria-sort', sort && other.dataset.key === key ? sort.direction : 'none');
      }
      draw();
    });
  }

  for (const input of view.querySelectorAll<HTMLInputElement>('input[data-filter]')) {
    input.addEventListener('input', () => {
      filters[input.dataset.filter as Key] = input.value;
      pageIndex = 0;
      draw();
    });
  }

  q(view, '[data-testid="clear-filters"]').addEventListener('click', () => {
    for (const input of view.querySelectorAll<HTMLInputElement>('input[data-filter]')) input.value = '';
    for (const column of COLUMNS) delete filters[column.key];
    pageIndex = 0;
    draw();
  });

  q(view, '[data-testid="add-new"]').addEventListener('click', () => {
    editing = { kind: 'new' };
    pageIndex = 0;
    draw();
    tbody.querySelector<HTMLInputElement>('input[name="firstName"]')?.focus();
  });

  q(view, '[data-testid="cancel-delete"]').addEventListener('click', () => deleteDialog.close());
  q(view, '[data-testid="confirm-delete"]').addEventListener('click', async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    pendingDelete = null; // a second click while the request is in flight does nothing
    const result = await api.contacts.remove(id);
    if (result.status === 204) contacts = contacts.filter((c) => c.id !== id);
    else showError('Could not delete the contact');
    deleteDialog.close();
    draw();
  });

  draw();
};

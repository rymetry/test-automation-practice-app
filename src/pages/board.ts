import { api } from '../api';
import { esc, html, q } from '../dom';
import type { Page } from '../router';
import { COLUMN_IDS, COLUMN_NAMES, type Card, type ColumnId } from '../types';
import { page } from '../ui/page';

/** A three-column board. Cards move by drag and drop, or with the "Move left" / "Move right" buttons. */
export const boardPage: Page = async (root) => {
  const initial = await api.board.get();
  let cards: Card[] = initial.data?.cards ?? [];

  const view = page(
    'Board',
    'カードをドラッグして別の列に落とすか、各カードの "Move left" / "Move right" で動かします。列は見出しの名前を持つ list、カードは listitem です。並びは API（GET /api/board）と同じです。',
    `
      <form class="row card" data-testid="new-card-form">
        <div class="field">
          <label for="new-card">New card</label>
          <input id="new-card" name="title" type="text" autocomplete="off" />
        </div>
        <div class="field">
          <label for="new-card-column">Column</label>
          <select id="new-card-column" name="column">
            ${COLUMN_IDS.map((id) => `<option value="${id}">${esc(COLUMN_NAMES[id])}</option>`).join('')}
          </select>
        </div>
        <div class="field"><span>&nbsp;</span><button type="submit" data-testid="add-card">Add card</button></div>
      </form>
      <div data-testid="board-error"></div>
      <div class="board">
        ${COLUMN_IDS.map(
          (id) => `
            <section class="column" data-column="${id}">
              <h2 id="column-${id}-title">${esc(COLUMN_NAMES[id])}</h2>
              <ul aria-labelledby="column-${id}-title" data-testid="column-${id}"></ul>
            </section>
          `,
        ).join('')}
      </div>
    `,
  );
  root.append(view);

  const errorBox = q(view, '[data-testid="board-error"]');
  const form = q<HTMLFormElement>(view, 'form');
  const titleInput = q<HTMLInputElement>(view, '#new-card');
  const columnSelect = q<HTMLSelectElement>(view, '#new-card-column');

  function showError(message: string | null): void {
    errorBox.innerHTML = '';
    if (message) errorBox.append(html(`<p role="alert" class="error">${esc(message)}</p>`));
  }

  async function move(id: number, column: ColumnId, position?: number): Promise<void> {
    const result = await api.board.moveCard(id, position === undefined ? { column } : { column, position });
    if (result.status === 200 && result.data) {
      cards = result.data.cards;
      showError(null);
    } else {
      showError('Could not move the card');
    }
    draw();
  }

  function cardItem(card: Card): HTMLLIElement {
    const index = COLUMN_IDS.indexOf(card.column);
    const item = html<HTMLLIElement>(`
      <li class="kanban-card" draggable="true" data-testid="card" data-id="${card.id}">
        <span class="card-title">${esc(card.title)}</span>
        <div class="row">
          <button type="button" class="btn-sm" data-action="left" ${index === 0 ? 'disabled' : ''}>Move left</button>
          <button type="button" class="btn-sm" data-action="right" ${index === COLUMN_IDS.length - 1 ? 'disabled' : ''}>Move right</button>
          <button type="button" class="btn-sm btn-ghost" data-action="delete">Delete</button>
        </div>
      </li>
    `);
    item.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', String(card.id));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    q(item, '[data-action="left"]').addEventListener('click', () => void move(card.id, COLUMN_IDS[index - 1]!));
    q(item, '[data-action="right"]').addEventListener('click', () => void move(card.id, COLUMN_IDS[index + 1]!));
    q(item, '[data-action="delete"]').addEventListener('click', async () => {
      const result = await api.board.removeCard(card.id);
      if (result.status === 204) cards = cards.filter((c) => c.id !== card.id);
      else showError('Could not delete the card');
      draw();
    });
    return item;
  }

  function draw(): void {
    for (const column of COLUMN_IDS) {
      const list = q<HTMLUListElement>(view, `[data-testid="column-${column}"]`);
      list.innerHTML = '';
      for (const card of cards.filter((c) => c.column === column).sort((a, b) => a.position - b.position)) {
        list.append(cardItem(card));
      }
    }
  }

  for (const section of view.querySelectorAll<HTMLElement>('.column')) {
    const column = section.dataset.column as ColumnId;
    section.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      section.classList.add('is-over');
    });
    section.addEventListener('dragleave', () => section.classList.remove('is-over'));
    section.addEventListener('drop', (event) => {
      event.preventDefault();
      section.classList.remove('is-over');
      const id = Number(event.dataTransfer?.getData('text/plain'));
      if (!id) return;
      // Insert before the first card whose middle is below the pointer; otherwise append.
      const items = [...section.querySelectorAll<HTMLElement>('li[data-id]')].filter((li) => Number(li.dataset.id) !== id);
      const position = items.findIndex((li) => {
        const box = li.getBoundingClientRect();
        return event.clientY < box.top + box.height / 2;
      });
      void move(id, column, position === -1 ? items.length : position);
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    if (!title) {
      showError('Card title is required');
      titleInput.focus();
      return;
    }
    const result = await api.board.addCard(title, columnSelect.value as ColumnId);
    if (result.status === 201 && result.data) {
      cards = [...cards, result.data];
      titleInput.value = '';
      showError(null);
    } else {
      showError('Could not add the card');
    }
    draw();
    titleInput.focus();
  });

  draw();
};

import { api, type Todo } from '../api';
import { esc, html, q, setTitle } from '../dom';
import type { Page } from '../router';

type Filter = 'all' | 'active' | 'completed';

export const todosPage: Page = async (root) => {
  setTitle('Todos');

  const view = html(`
    <section>
      <h1>Todos</h1>
      <form data-testid="new-todo-form" class="row">
        <label for="new-todo">New todo</label>
        <input id="new-todo" name="title" type="text" autocomplete="off" data-testid="new-todo-input" />
        <button type="submit" data-testid="add-todo">Add</button>
      </form>
      <fieldset data-testid="filters" class="row">
        <legend>Filter</legend>
        <label><input type="radio" name="filter" value="all" checked /> All</label>
        <label><input type="radio" name="filter" value="active" /> Active</label>
        <label><input type="radio" name="filter" value="completed" /> Completed</label>
      </fieldset>
      <ul aria-label="Todos" data-testid="todo-list" class="todo-list"></ul>
      <p role="status" data-testid="remaining"></p>
    </section>
  `);
  root.append(view);

  const form = q<HTMLFormElement>(view, 'form');
  const input = q<HTMLInputElement>(view, '#new-todo');
  const list = q<HTMLUListElement>(view, 'ul');
  const remaining = q(view, '[data-testid="remaining"]');

  let todos: Todo[] = [];
  let filter: Filter = 'all';

  function draw(): void {
    list.innerHTML = '';
    const visible = todos.filter((todo) =>
      filter === 'all' ? true : filter === 'active' ? !todo.done : todo.done,
    );
    for (const todo of visible) {
      const item = html<HTMLLIElement>(`
        <li data-testid="todo-item" class="${todo.done ? 'done' : ''}">
          <label>
            <input type="checkbox" ${todo.done ? 'checked' : ''} />
            <span class="title">${esc(todo.title)}</span>
          </label>
          <button type="button" data-testid="delete-todo">Delete</button>
        </li>
      `);
      q<HTMLInputElement>(item, 'input').addEventListener('change', async (event) => {
        const checkbox = event.currentTarget as HTMLInputElement;
        const result = await api.todos.setDone(todo.id, checkbox.checked);
        if (result.status === 200 && result.data) {
          todos = todos.map((t) => (t.id === todo.id ? result.data! : t));
        }
        draw();
      });
      q<HTMLButtonElement>(item, 'button').addEventListener('click', async () => {
        await api.todos.remove(todo.id);
        todos = todos.filter((t) => t.id !== todo.id);
        draw();
      });
      list.append(item);
    }
    const left = todos.filter((todo) => !todo.done).length;
    remaining.textContent = `${left} remaining`;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = input.value.trim();
    if (!title) {
      // An empty submission is ignored on purpose: nothing is sent and the list does not change.
      input.focus();
      return;
    }
    // Clear the field right away so fast typing never merges two titles; put the text back if the save fails.
    input.value = '';
    const result = await api.todos.add(title);
    if (result.status === 201 && result.data) {
      todos = [...todos, result.data];
      draw();
    } else {
      input.value = title;
    }
    input.focus();
  });

  view.querySelectorAll<HTMLInputElement>('input[name="filter"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      filter = radio.value as Filter;
      draw();
    });
  });

  const result = await api.todos.list();
  todos = result.data ?? [];
  draw();
};

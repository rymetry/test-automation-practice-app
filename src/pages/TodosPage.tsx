import { useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { flushSync } from 'react-dom';
import { api, type Todo } from '../api';
import { useDocumentTitle } from '../ui/PageLayout';

type Filter = 'all' | 'active' | 'completed';

export function TodosPage(): JSX.Element | null {
  useDocumentTitle('Todos');
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<ReadonlySet<number>>(() => new Set());
  const [newTitle, setNewTitle] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    // 一覧を取得してから描画する。フォームが先に出ると、一覧が届く前の操作が上書きされてしまう。
    void api.todos
      .list()
      .then(
        (result) => (result.status === 200 && Array.isArray(result.data) ? result.data : null),
        () => null,
      )
      .then((initial) => {
        if (cancelled) return;
        setTodos(initial ?? []);
        setLoadFailed(initial === null);
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  if (todos === null) return null;

  const visible = todos.filter((todo) => (filter === 'all' ? true : filter === 'active' ? !todo.done : todo.done));
  const left = todos.filter((todo) => !todo.done).length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) {
      // 空送信は意図的に無視し、リクエストも一覧変更も行わない。
      inputRef.current?.focus();
      return;
    }

    // 連続入力で 2 件のタイトルが混ざらないよう即時クリアする。
    setNewTitle('');
    const result = await api.todos.add(title).catch(() => null);
    if (!mountedRef.current) return;
    if (result?.status === 201 && result.data) {
      const added = result.data;
      setTodos((current) => (current ? [...current, added] : [added]));
      setError(null);
    } else {
      // 通信中に次のタイトルを打ち始めていれば、そちらを消さない。
      setNewTitle((current) => (current.trim() ? current : title));
      setError('Could not add the todo');
    }
    inputRef.current?.focus();
  }

  async function handleToggle(checkbox: HTMLInputElement, id: number, done: boolean): Promise<void> {
    // 制御された checkbox は state が変わるまでクリック直後に元へ戻り、Playwright の check() が失敗するため先に反映する。
    const setDone = (value: boolean): void =>
      setTodos((current) => (current ? current.map((todo) => (todo.id === id ? { ...todo, done: value } : todo)) : current));
    setDone(done);
    const hadFocus = document.activeElement === checkbox;
    // 同じ todo の保存が重なると、遅れて届いた失敗が後の操作を巻き戻すため、保存中は checkbox を無効にする。
    setTogglingIds((current) => new Set(current).add(id));
    const result = await api.todos.setDone(id, done).catch(() => null);
    if (!mountedRef.current) return;
    // 無効にした要素からはフォーカスが body へ外れるので、有効に戻す描画を確定させてから戻す。
    flushSync(() =>
      setTogglingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      }),
    );
    if (hadFocus && document.activeElement === document.body) checkbox.focus();
    if (result?.status === 200 && result.data) {
      const updated = result.data;
      setTodos((current) => (current ? current.map((todo) => (todo.id === id ? updated : todo)) : current));
    } else {
      setDone(!done);
    }
  }

  async function handleDelete(id: number): Promise<void> {
    const result = await api.todos.remove(id).catch(() => null);
    if (!mountedRef.current) return;
    // 404 は既に消えているので一覧から外す。それ以外の失敗では todo を残して知らせる。
    if (result?.status === 204 || result?.status === 404) {
      setTodos((current) => (current ? current.filter((todo) => todo.id !== id) : current));
      setError(null);
    } else {
      setError('Could not delete the todo');
    }
  }

  return (
    <section className="page-medium">
      <h1>Todos</h1>
      <form data-testid="new-todo-form" className="row card" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="new-todo">New todo</label>
        <input
          ref={inputRef}
          id="new-todo"
          name="title"
          type="text"
          autoComplete="off"
          data-testid="new-todo-input"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
        />
        <button type="submit" data-testid="add-todo">
          Add
        </button>
      </form>
      <div data-testid="todo-error">
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
      </div>
      <fieldset data-testid="filters" className="row">
        <legend>Filter</legend>
        <label>
          <input type="radio" name="filter" value="all" checked={filter === 'all'} onChange={() => setFilter('all')} /> All
        </label>
        <label>
          <input type="radio" name="filter" value="active" checked={filter === 'active'} onChange={() => setFilter('active')} /> Active
        </label>
        <label>
          <input
            type="radio"
            name="filter"
            value="completed"
            checked={filter === 'completed'}
            onChange={() => setFilter('completed')}
          />{' '}
          Completed
        </label>
      </fieldset>
      {loadFailed ? (
        <p role="alert" className="error" data-testid="todos-load-error">
          Could not load todos
        </p>
      ) : null}
      <ul aria-label="Todos" data-testid="todo-list" className="todo-list">
        {visible.map((todo) => (
          <li key={todo.id} data-testid="todo-item" className={todo.done ? 'done' : undefined}>
            <label>
              <input
                type="checkbox"
                checked={todo.done}
                disabled={togglingIds.has(todo.id)}
                onChange={(event) => void handleToggle(event.currentTarget, todo.id, event.target.checked)}
              />
              <span className="title">{todo.title}</span>
            </label>
            <button type="button" className="btn-sm" data-testid="delete-todo" onClick={() => void handleDelete(todo.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <p role="status" data-testid="remaining">
        {left} remaining
      </p>
    </section>
  );
}


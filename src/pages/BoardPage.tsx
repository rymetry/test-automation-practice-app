import { useEffect, useRef, useState, type DragEvent, type FormEvent, type JSX } from 'react';
import { api } from '../api';
import { COLUMN_IDS, COLUMN_NAMES, type Card, type ColumnId } from '../types';
import { PageLayout } from '../ui/PageLayout';

/** 3 列のカンバンボード。ドラッグ＆ドロップまたは Move left / Move right ボタンでカードを移動する。 */
export function BoardPage(): JSX.Element | null {
  const [loaded, setLoaded] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newColumn, setNewColumn] = useState<ColumnId>('todo');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overColumn, setOverColumn] = useState<ColumnId | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  // requestSubmit() や再描画前の連続送信は無効化したボタンを経由しないため、ハンドラでも再入を止める。
  const addingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void api.board
      .get()
      .then(
        (result) => (result.status === 200 && Array.isArray(result.data?.cards) ? result.data.cards : null),
        () => null,
      )
      .then((initial) => {
        if (cancelled) return;
        setCards(initial ?? []);
        setLoadFailed(initial === null);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  const moveCard = async (id: number, column: ColumnId, position?: number): Promise<void> => {
    const result = await api.board.moveCard(id, position === undefined ? { column } : { column, position });
    if (result.status === 200 && Array.isArray(result.data?.cards)) {
      // 応答は全カードの一覧なので、初回取得の失敗もここで解消する。
      setCards(result.data.cards);
      setLoadFailed(false);
      setError(null);
    } else {
      setError('Could not move the card');
    }
  };

  const handleDeleteCard = async (id: number): Promise<void> => {
    const result = await api.board.removeCard(id);
    if (result.status === 204) {
      setCards((prev) => prev.filter((card) => card.id !== id));
    } else {
      setError('Could not delete the card');
    }
  };

  const handleDrop = (column: ColumnId, event: DragEvent<HTMLElement>): void => {
    event.preventDefault();
    setOverColumn(null);
    const id = Number(event.dataTransfer.getData('text/plain'));
    if (!id) return;
    // ポインタより中点が下にある最初のカードの前に挿入し、該当が無ければ末尾へ追加する。
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('li[data-id]')].filter(
      (li) => Number(li.dataset.id) !== id,
    );
    const position = items.findIndex((li) => {
      const box = li.getBoundingClientRect();
      return event.clientY < box.top + box.height / 2;
    });
    void moveCard(id, column, position === -1 ? items.length : position);
  };

  const handleAddCard = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (addingRef.current) return;
    const title = newTitle.trim();
    if (!title) {
      setError('Card title is required');
      titleInputRef.current?.focus();
      return;
    }
    addingRef.current = true;
    setAdding(true);
    try {
      const result = await api.board.addCard(title, newColumn);
      if (result.status === 201 && result.data) {
        const added = result.data;
        setCards((prev) => [...prev, added]);
        setNewTitle('');
        setError(null);
      } else {
        setError('Could not add the card');
      }
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
    titleInputRef.current?.focus();
  };

  return (
    <PageLayout
      title="Board"
      intro='カードをドラッグして別の列に落とすか、各カードの "Move left" / "Move right" で動かします。列は見出しの名前を持つ list、カードは listitem です。並びは API（GET /api/board）と同じです。'
    >
      <form
        className="form-inline card"
        data-testid="new-card-form"
        onSubmit={(event) => {
          void handleAddCard(event);
        }}
      >
        <div className="field">
          <label htmlFor="new-card">New card</label>
          <input
            ref={titleInputRef}
            id="new-card"
            name="title"
            type="text"
            autoComplete="off"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new-card-column">Column</label>
          <select
            id="new-card-column"
            name="column"
            value={newColumn}
            onChange={(event) => setNewColumn(event.target.value as ColumnId)}
          >
            {COLUMN_IDS.map((id) => (
              <option key={id} value={id}>
                {COLUMN_NAMES[id]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" data-testid="add-card" disabled={adding}>
          Add card
        </button>
      </form>
      {loadFailed ? (
        <p role="alert" className="error" data-testid="board-load-error">
          Could not load the board
        </p>
      ) : null}
      <div data-testid="board-error">
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
      </div>
      <div className="board">
        {COLUMN_IDS.map((id) => {
          const columnCards = cards.filter((card) => card.column === id).sort((a, b) => a.position - b.position);
          return (
            <section
              key={id}
              className={overColumn === id ? 'column is-over' : 'column'}
              data-column={id}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOverColumn(id);
              }}
              onDragLeave={() => {
                setOverColumn((prev) => (prev === id ? null : prev));
              }}
              onDrop={(event) => handleDrop(id, event)}
            >
              <h2 id={`column-${id}-title`}>{COLUMN_NAMES[id]}</h2>
              <ul aria-labelledby={`column-${id}-title`} data-testid={`column-${id}`}>
                {columnCards.map((card) => {
                  const index = COLUMN_IDS.indexOf(card.column);
                  const prevColumn = COLUMN_IDS[index - 1];
                  const nextColumn = COLUMN_IDS[index + 1];
                  return (
                    <li
                      key={card.id}
                      className={draggingId === card.id ? 'kanban-card is-dragging' : 'kanban-card'}
                      draggable
                      data-testid="card"
                      data-id={card.id}
                      onDragStart={(event) => {
                        setDraggingId(card.id);
                        event.dataTransfer.setData('text/plain', String(card.id));
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverColumn(null);
                      }}
                    >
                      <span className="card-title">{card.title}</span>
                      <div className="row">
                        <button
                          type="button"
                          className="btn-sm"
                          data-action="left"
                          disabled={prevColumn === undefined}
                          onClick={() => {
                            if (prevColumn) void moveCard(card.id, prevColumn);
                          }}
                        >
                          Move left
                        </button>
                        <button
                          type="button"
                          className="btn-sm"
                          data-action="right"
                          disabled={nextColumn === undefined}
                          onClick={() => {
                            if (nextColumn) void moveCard(card.id, nextColumn);
                          }}
                        >
                          Move right
                        </button>
                        <button
                          type="button"
                          className="btn-sm btn-ghost"
                          data-action="delete"
                          onClick={() => {
                            void handleDeleteCard(card.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </PageLayout>
  );
}


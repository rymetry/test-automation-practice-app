import { useEffect, useRef, useState, type JSX } from 'react';

export interface DatePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

interface DayCell {
  iso: string;
  day: number;
  ariaLabel: string;
  disabled: boolean;
  selected: boolean;
  isToday: boolean;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const WEEKDAYS = [
  ['Mo', 'Monday'],
  ['Tu', 'Tuesday'],
  ['We', 'Wednesday'],
  ['Th', 'Thursday'],
  ['Fr', 'Friday'],
  ['Sa', 'Saturday'],
  ['Su', 'Sunday'],
] as const;

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD をローカル日付として解釈する（new Date(string) の UTC 解釈を避けるため）。 */
export function fromIso(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * 読み取り専用のテキスト入力とカレンダーポップアップ。全体をラベル名の group とし、
 * 複数ピッカーがある画面でも "Choose date" を個別に絞り込めるようにする。
 */
export function DatePicker({ id, label, value, onChange, min, max }: DatePickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => startOfMonth(new Date()));
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    if (!open) return;

    const body = tbodyRef.current;
    const focusTarget =
      body?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
      body?.querySelector<HTMLButtonElement>('button.is-today:not(:disabled)') ??
      body?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    focusTarget?.focus();

    const onOutside = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleToggle = (): void => {
    if (open) {
      setOpen(false);
      return;
    }
    setView(startOfMonth(value ? fromIso(value) : new Date()));
    setOpen(true);
  };

  const handleSelect = (iso: string): void => {
    onChange(iso);
    setOpen(false);
    toggleRef.current?.focus();
  };

  const handlePrevMonth = (): void => {
    setView((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = (): void => {
    setView((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const today = toIso(new Date());
  const first = new Date(view);
  // 月曜始まりのグリッドのため、月初以前の直近月曜まで巻き戻す。
  const offset = (first.getDay() + 6) % 7;
  let cursor = addDays(first, -offset);
  const weeks: Array<Array<DayCell | null>> = [];

  for (let week = 0; week < 6; week++) {
    const row: Array<DayCell | null> = [];
    for (let day = 0; day < 7; day++) {
      if (cursor.getMonth() === view.getMonth()) {
        const iso = toIso(cursor);
        row.push({
          iso,
          day: cursor.getDate(),
          ariaLabel: `${cursor.getDate()} ${MONTHS[cursor.getMonth()] ?? ''} ${cursor.getFullYear()}`,
          disabled: (min !== undefined && iso < min) || (max !== undefined && iso > max),
          selected: iso === value,
          isToday: iso === today,
        });
      } else {
        row.push(null);
      }
      cursor = addDays(cursor, 1);
    }
    weeks.push(row);
    if (cursor.getMonth() !== view.getMonth()) break;
  }

  const monthLabel = `${MONTHS[view.getMonth()] ?? ''} ${view.getFullYear()}`;

  return (
    <div className="datepicker" role="group" aria-labelledby={`${id}-label`} ref={rootRef}>
      <label id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <div className="datepicker-row">
        <input
          id={id}
          name={id}
          type="text"
          readOnly
          placeholder="YYYY-MM-DD"
          value={value}
          data-testid={id}
        />
        <button
          ref={toggleRef}
          type="button"
          className="btn-icon"
          aria-label="Choose date"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={handleToggle}
        >
          📅
        </button>
      </div>
      <div className="calendar" role="dialog" aria-label="Choose date" hidden={!open}>
        <div className="calendar-head">
          <button type="button" className="btn-icon btn-sm" aria-label="Previous month" onClick={handlePrevMonth}>
            ‹
          </button>
          <p aria-live="polite" data-testid={`${id}-month`}>
            {monthLabel}
          </p>
          <button type="button" className="btn-icon btn-sm" aria-label="Next month" onClick={handleNextMonth}>
            ›
          </button>
        </div>
        <table role="grid">
          <thead>
            <tr>
              {WEEKDAYS.map(([short, long]) => (
                <th key={long} scope="col" abbr={long}>
                  {short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody ref={tbodyRef}>
            {weeks.map((week, weekIndex) => (
              <tr key={weekIndex}>
                {week.map((cell, dayIndex) => (
                  <td key={dayIndex} role="gridcell">
                    {cell ? (
                      <button
                        type="button"
                        aria-label={cell.ariaLabel}
                        disabled={cell.disabled}
                        aria-pressed={cell.selected}
                        className={cell.isToday ? 'is-today' : undefined}
                        onClick={() => handleSelect(cell.iso)}
                      >
                        {cell.day}
                      </button>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

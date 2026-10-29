import { esc, html, q } from '../dom';

export interface DatePickerOptions {
  /** Used for the input id and the test id. */
  id: string;
  label: string;
  /** Inclusive bounds as YYYY-MM-DD. Days outside are disabled. */
  min?: string;
  max?: string;
}

export interface DatePicker {
  el: HTMLElement;
  input: HTMLInputElement;
  /** Replaces the bounds; the open calendar redraws. */
  setBounds(min?: string, max?: string): void;
  onChange(listener: (value: string) => void): void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = [
  ['Mo', 'Monday'], ['Tu', 'Tuesday'], ['We', 'Wednesday'], ['Th', 'Thursday'],
  ['Fr', 'Friday'], ['Sa', 'Saturday'], ['Su', 'Sunday'],
];

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * A read-only text field with a calendar popup. The whole thing is a `group` named by the label, so a page with
 * several pickers can scope "Choose date" to one of them. Day buttons are named "15 November 2026".
 */
export function createDatePicker(options: DatePickerOptions): DatePicker {
  let { min, max } = options;
  let view = startOfMonth(new Date());
  const listeners: Array<(value: string) => void> = [];

  const el = html(`
    <div class="datepicker" role="group" aria-labelledby="${esc(options.id)}-label">
      <label id="${esc(options.id)}-label" for="${esc(options.id)}">${esc(options.label)}</label>
      <div class="datepicker-row">
        <input id="${esc(options.id)}" name="${esc(options.id)}" type="text" readonly placeholder="YYYY-MM-DD" data-testid="${esc(options.id)}" />
        <button type="button" class="btn-icon" aria-label="Choose date" aria-haspopup="dialog" aria-expanded="false">📅</button>
      </div>
      <div class="calendar" role="dialog" aria-label="Choose date" hidden>
        <div class="calendar-head">
          <button type="button" class="btn-icon btn-sm" aria-label="Previous month">‹</button>
          <p aria-live="polite" data-testid="${esc(options.id)}-month"></p>
          <button type="button" class="btn-icon btn-sm" aria-label="Next month">›</button>
        </div>
        <table role="grid">
          <thead><tr>${WEEKDAYS.map(([short, long]) => `<th scope="col" abbr="${long}">${short}</th>`).join('')}</tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `);
  const input = q<HTMLInputElement>(el, 'input');
  const toggle = q<HTMLButtonElement>(el, '.datepicker-row button');
  const calendar = q(el, '.calendar');
  const monthLabel = q(el, '.calendar-head p');
  const body = q<HTMLTableSectionElement>(el, 'tbody');

  function isDisabled(iso: string): boolean {
    return (min !== undefined && iso < min) || (max !== undefined && iso > max);
  }

  function draw(): void {
    monthLabel.textContent = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
    body.innerHTML = '';
    const today = toIso(new Date());
    const first = new Date(view);
    // Monday-first grid: back up to the Monday on or before the 1st.
    const offset = (first.getDay() + 6) % 7;
    let cursor = addDays(first, -offset);
    for (let week = 0; week < 6; week++) {
      const row = document.createElement('tr');
      for (let day = 0; day < 7; day++) {
        const cell = document.createElement('td');
        cell.setAttribute('role', 'gridcell');
        if (cursor.getMonth() === view.getMonth()) {
          const iso = toIso(cursor);
          const button = html<HTMLButtonElement>(
            `<button type="button" aria-label="${cursor.getDate()} ${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}">${cursor.getDate()}</button>`,
          );
          button.disabled = isDisabled(iso);
          button.setAttribute('aria-pressed', String(iso === input.value));
          button.classList.toggle('is-today', iso === today);
          button.addEventListener('click', () => {
            input.value = iso;
            for (const listener of listeners) listener(iso);
            close();
            toggle.focus();
          });
          cell.append(button);
        }
        row.append(cell);
        cursor = addDays(cursor, 1);
      }
      body.append(row);
      if (cursor.getMonth() !== view.getMonth()) break;
    }
  }

  function open(): void {
    view = startOfMonth(input.value ? new Date(input.value) : new Date());
    draw();
    calendar.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    const focusTarget =
      body.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
      body.querySelector<HTMLButtonElement>('button.is-today:not(:disabled)') ??
      body.querySelector<HTMLButtonElement>('button:not(:disabled)');
    focusTarget?.focus();
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('keydown', onKey);
  }

  function close(): void {
    calendar.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener('keydown', onKey);
  }

  function onOutside(event: PointerEvent): void {
    if (!el.contains(event.target as Node)) close();
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      close();
      toggle.focus();
    }
  }

  toggle.addEventListener('click', () => (calendar.hidden ? open() : close()));
  q(el, '[aria-label="Previous month"]').addEventListener('click', () => {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    draw();
  });
  q(el, '[aria-label="Next month"]').addEventListener('click', () => {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    draw();
  });

  return {
    el,
    input,
    setBounds(newMin, newMax) {
      min = newMin;
      max = newMax;
      if (!calendar.hidden) draw();
    },
    onChange(listener) {
      listeners.push(listener);
    },
  };
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

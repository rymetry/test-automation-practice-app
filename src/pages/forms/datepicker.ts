import { q } from '../../dom';
import type { Page } from '../../router';
import { addDays, createDatePicker, toIso } from '../../ui/datepicker';
import { page } from '../../ui/page';

/** Three date pickers: a plain one, a start/end pair, and one with a 7-day window around today. */
export const datepickerPage: Page = (root) => {
  const today = new Date();
  const view = page(
    'Datepicker',
    '日付の入力欄は読み取り専用で、カレンダーから選びます。各入力欄は "Date" や "Start date" という名前の group なので、その中の "Choose date" ボタンや日付ボタン（"15 November 2026" のような名前）を指せます。値は YYYY-MM-DD です。',
    `
      <div class="grid-2">
        <section class="card" aria-labelledby="common-title">
          <h2 id="common-title">Common datepicker</h2>
          <div data-slot="common"></div>
        </section>
        <section class="card" aria-labelledby="range-title">
          <h2 id="range-title">Datepicker with range</h2>
          <p class="muted">終了日は開始日より前を選べません。</p>
          <div class="row" data-slot="range"></div>
        </section>
        <section class="card" aria-labelledby="limits-title">
          <h2 id="limits-title">Datepicker with limits</h2>
          <p class="muted">今日の前後 7 日だけ選べます（${toIso(addDays(today, -7))} 〜 ${toIso(addDays(today, 7))}）。</p>
          <div data-slot="limits"></div>
        </section>
      </div>
    `,
  );
  root.append(view);

  const common = createDatePicker({ id: 'date', label: 'Date' });
  q(view, '[data-slot="common"]').append(common.el);

  const start = createDatePicker({ id: 'start-date', label: 'Start date' });
  const end = createDatePicker({ id: 'end-date', label: 'End date' });
  start.onChange((value) => {
    end.setBounds(value, undefined);
    if (end.input.value && end.input.value < value) end.input.value = '';
  });
  q(view, '[data-slot="range"]').append(start.el, end.el);

  const limited = createDatePicker({
    id: 'limited-date',
    label: 'Date with limits',
    min: toIso(addDays(today, -7)),
    max: toIso(addDays(today, 7)),
  });
  q(view, '[data-slot="limits"]').append(limited.el);
};

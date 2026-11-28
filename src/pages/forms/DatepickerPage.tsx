import { useState, type JSX } from 'react';
import type { Page } from '../../router';
import { addDays, DatePicker, toIso } from '../../ui/DatePicker';
import { mountReact } from '../../ui/mount-react';
import { PageLayout } from '../../ui/PageLayout';

/** 通常・範囲指定（開始／終了）・前後 7 日制限の 3 種の Datepicker 練習ページ。 */
export function DatepickerPage(): JSX.Element {
  const [today] = useState(() => new Date());
  const [commonDate, setCommonDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limitedDate, setLimitedDate] = useState('');

  const minLimit = toIso(addDays(today, -7));
  const maxLimit = toIso(addDays(today, 7));

  const handleStartChange = (value: string): void => {
    setStartDate(value);
    setEndDate((prev) => (prev && prev < value ? '' : prev));
  };

  return (
    <PageLayout
      title="Datepicker"
      intro='日付の入力欄は読み取り専用で、カレンダーから選びます。各入力欄は "Date" や "Start date" という名前の group なので、その中の "Choose date" ボタンや日付ボタン（"15 November 2026" のような名前）を指せます。値は YYYY-MM-DD です。'
      size="medium"
    >
      <section className="card" aria-labelledby="common-title">
        <h2 id="common-title">Common datepicker</h2>
        <div data-slot="common">
          <DatePicker id="date" label="Date" value={commonDate} onChange={setCommonDate} />
        </div>
      </section>
      <section className="card" aria-labelledby="range-title">
        <h2 id="range-title">Datepicker with range</h2>
        <p className="muted">終了日は開始日より前を選べません。</p>
        <div className="row datepicker-range" data-slot="range">
          <DatePicker id="start-date" label="Start date" value={startDate} onChange={handleStartChange} />
          <DatePicker
            id="end-date"
            label="End date"
            value={endDate}
            onChange={setEndDate}
            min={startDate || undefined}
          />
        </div>
      </section>
      <section className="card" aria-labelledby="limits-title">
        <h2 id="limits-title">Datepicker with limits</h2>
        <p className="muted">
          今日の前後 7 日だけ選べます（{minLimit} 〜 {maxLimit}）。
        </p>
        <div data-slot="limits">
          <DatePicker
            id="limited-date"
            label="Date with limits"
            value={limitedDate}
            onChange={setLimitedDate}
            min={minLimit}
            max={maxLimit}
          />
        </div>
      </section>
    </PageLayout>
  );
}

export const datepickerPage: Page = mountReact(DatepickerPage);

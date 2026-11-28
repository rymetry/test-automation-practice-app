import { useEffect, useState, type FormEvent, type JSX } from 'react';
import { api } from '../../api';
import type { FormId, FormValues } from '../../types';
import { summarize } from '../../ui/format';
import { PageLayout } from '../../ui/PageLayout';

type FieldKind = 'text' | 'email' | 'password' | 'url' | 'checkbox';

interface Field {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
}

interface Layout {
  id: FormId;
  title: string;
  className: string;
  fields: Field[];
  /** ラジオグループを持つのは Using the grid フォームのみ。 */
  radios?: { key: string; legend: string; options: string[] };
  submit: string;
}

const LAYOUTS: Layout[] = [
  {
    id: 'inline',
    title: 'Inline form',
    className: 'form-inline',
    fields: [
      { key: 'name', label: 'Name', kind: 'text', required: true },
      { key: 'email', label: 'Email', kind: 'email', required: true },
      { key: 'remember', label: 'Remember me', kind: 'checkbox' },
    ],
    submit: 'Submit',
  },
  {
    id: 'grid',
    title: 'Using the grid',
    className: 'form-grid',
    fields: [
      { key: 'email', label: 'Email', kind: 'email', required: true },
      { key: 'password', label: 'Password', kind: 'password', required: true },
    ],
    radios: { key: 'option', legend: 'Option', options: ['Option 1', 'Option 2'] },
    submit: 'Sign in',
  },
  {
    id: 'basic',
    title: 'Basic form',
    className: 'stack stack-wide',
    fields: [
      { key: 'email', label: 'Email', kind: 'email', required: true },
      { key: 'password', label: 'Password', kind: 'password', required: true },
      { key: 'checkMeOut', label: 'Check me out', kind: 'checkbox' },
    ],
    submit: 'Submit',
  },
  {
    id: 'block',
    title: 'Block form',
    className: 'form-grid',
    fields: [
      { key: 'firstName', label: 'First name', kind: 'text', required: true },
      { key: 'lastName', label: 'Last name', kind: 'text', required: true },
      { key: 'email', label: 'Email', kind: 'email', required: true },
      { key: 'website', label: 'Website', kind: 'url' },
    ],
    submit: 'Submit',
  },
  {
    id: 'horizontal',
    title: 'Horizontal form',
    className: 'form-horizontal stack stack-wide',
    fields: [
      { key: 'email', label: 'Email', kind: 'email', required: true },
      { key: 'password', label: 'Password', kind: 'password', required: true },
      { key: 'remember', label: 'Remember me', kind: 'checkbox' },
    ],
    submit: 'Sign in',
  },
];

function createInitialValues(layout: Layout): FormValues {
  const values: FormValues = {};
  for (const field of layout.fields) {
    values[field.key] = field.kind === 'checkbox' ? false : '';
  }
  if (layout.radios) {
    values[layout.radios.key] = layout.radios.options[0] ?? '';
  }
  return values;
}

/** 最初に見つかった入力エラー文言（alert のアクセシブル名）を返す。問題なければ null。 */
function validate(layout: Layout, values: FormValues): string | null {
  for (const field of layout.fields) {
    const value = values[field.key];
    if (field.required && typeof value === 'string' && !value) return `${field.label} is required`;
    if (field.kind === 'email' && typeof value === 'string' && value && !value.includes('@')) return 'Email must contain @';
    if (field.kind === 'password' && typeof value === 'string' && value && value.length < 8) {
      return 'Password must be at least 8 characters';
    }
  }
  return null;
}

interface LayoutFormProps {
  layout: Layout;
  initialResult: string;
}

function LayoutForm({ layout, initialResult }: LayoutFormProps): JSX.Element {
  const [values, setValues] = useState<FormValues>(() => createInitialValues(layout));
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string>(initialResult);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    const trimmed: FormValues = {};
    for (const field of layout.fields) {
      const current = values[field.key];
      trimmed[field.key] = field.kind === 'checkbox' ? Boolean(current) : String(current ?? '').trim();
    }
    if (layout.radios) {
      trimmed[layout.radios.key] = String(values[layout.radios.key] ?? '');
    }

    const problem = validate(layout, trimmed);
    if (problem) {
      setError(problem);
      return;
    }

    setSubmitting(true);
    try {
      const saved = await api.forms.submit(layout.id, trimmed);
      if (saved.status === 201 && saved.data) {
        setResult(`Submitted: ${summarize(saved.data.values)}`);
        setValues(createInitialValues(layout));
      } else {
        setError('Could not save the form');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const radios = layout.radios;

  return (
    <form
      aria-labelledby={`form-${layout.id}-title`}
      data-testid={`form-${layout.id}`}
      className={`card${layout.id === 'inline' ? ' span-2' : ''}`}
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <h2 id={`form-${layout.id}-title`}>{layout.title}</h2>
      <div className={layout.className}>
        {layout.fields.map((field) => {
          const id = `${layout.id}-${field.key}`;
          if (field.kind === 'checkbox') {
            return (
              <div key={field.key} className="field field-inline field-check">
                <input
                  id={id}
                  name={field.key}
                  type="checkbox"
                  checked={Boolean(values[field.key])}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setValues((prev) => ({ ...prev, [field.key]: checked }));
                  }}
                />
                <label htmlFor={id}>{field.label}</label>
              </div>
            );
          }
          const raw = values[field.key];
          const value = typeof raw === 'string' ? raw : '';
          return (
            <div key={field.key} className="field">
              <label htmlFor={id}>{field.label}</label>
              <input
                id={id}
                name={field.key}
                type={field.kind}
                autoComplete={field.kind === 'password' ? 'new-password' : 'off'}
                value={value}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setValues((prev) => ({ ...prev, [field.key]: nextValue }));
                }}
              />
            </div>
          );
        })}
        {radios ? (
          <fieldset className="span-2">
            <legend>{radios.legend}</legend>
            {radios.options.map((option) => (
              <label key={option}>
                <input
                  type="radio"
                  name={radios.key}
                  value={option}
                  checked={values[radios.key] === option}
                  onChange={() => {
                    setValues((prev) => ({ ...prev, [radios.key]: option }));
                  }}
                />{' '}
                {option}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="field field-submit">
          <button type="submit" disabled={submitting}>
            {layout.submit}
          </button>
        </div>
      </div>
      <div data-testid={`form-${layout.id}-error`}>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
      </div>
      <p role="status" className="result" data-testid={`form-${layout.id}-result`}>
        {result || null}
      </p>
    </form>
  );
}

/** 5 種類のフォームレイアウト。各フォームは見出しの名前を持ち、送信内容はセッションに保存される。 */
export function LayoutsPage(): JSX.Element | null {
  const [loaded, setLoaded] = useState(false);
  const [initialResults, setInitialResults] = useState<Partial<Record<FormId, string>>>({});

  useEffect(() => {
    let cancelled = false;
    void api.forms.list().then((saved) => {
      if (cancelled) return;
      const next: Partial<Record<FormId, string>> = {};
      for (const submission of saved.data ?? []) {
        next[submission.form] = `Submitted: ${summarize(submission.values)}`;
      }
      setInitialResults(next);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) return null;

  return (
    <PageLayout
      title="Form layouts"
      intro='Bondar Academy の playground と同じ 5 種類のレイアウトです。各フォームは見出しの名前を持つ form なので、同じ "Email" が 5 つあってもフォーム単位で絞り込めます。送信内容はセッションに保存され、リロードしても残ります。'
    >
      <div className="grid-2">
        {LAYOUTS.map((layout) => (
          <LayoutForm key={layout.id} layout={layout} initialResult={initialResults[layout.id] ?? ''} />
        ))}
      </div>
    </PageLayout>
  );
}


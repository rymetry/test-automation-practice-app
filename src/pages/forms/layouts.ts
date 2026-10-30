import { api } from '../../api';
import { esc, html, q } from '../../dom';
import type { Page } from '../../router';
import type { FormId, FormValues } from '../../types';
import { page, summarize } from '../../ui/page';

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
  /** The grid layout has a radio group; nobody else does. */
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
    className: 'stack',
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

function fieldMarkup(formId: string, field: Field): string {
  const id = `${formId}-${field.key}`;
  if (field.kind === 'checkbox') {
    return `
      <div class="field field-inline field-check">
        <input id="${id}" name="${field.key}" type="checkbox" />
        <label for="${id}">${esc(field.label)}</label>
      </div>
    `;
  }
  const autocomplete = field.kind === 'password' ? 'autocomplete="new-password"' : 'autocomplete="off"';
  return `
    <div class="field">
      <label for="${id}">${esc(field.label)}</label>
      <input id="${id}" name="${field.key}" type="${field.kind}" ${autocomplete} />
    </div>
  `;
}

function radiosMarkup(formId: string, radios: NonNullable<Layout['radios']>): string {
  return `
    <fieldset class="span-2">
      <legend>${esc(radios.legend)}</legend>
      ${radios.options
        .map(
          (option, index) => `
            <label><input type="radio" name="${radios.key}" value="${esc(option)}" ${index === 0 ? 'checked' : ''} /> ${esc(option)}</label>
          `,
        )
        .join('')}
    </fieldset>
  `;
}

/** The first problem with the values, or null. Messages are the accessible names of the alerts. */
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

/** Five form layouts. Each is a `form` named by its heading; submissions are saved per form and shown again on reload. */
export const formLayoutsPage: Page = async (root) => {
  const saved = await api.forms.list();
  const latest = new Map((saved.data ?? []).map((submission) => [submission.form, submission]));

  const view = page(
    'Form layouts',
    'Bondar Academy の playground と同じ 5 種類のレイアウトです。各フォームは見出しの名前を持つ form なので、同じ "Email" が 5 つあってもフォーム単位で絞り込めます。送信内容はセッションに保存され、リロードしても残ります。',
    `<div class="grid-2">${LAYOUTS.map(
      (layout) => `
        <form aria-labelledby="form-${layout.id}-title" data-testid="form-${layout.id}" class="card" novalidate>
          <h2 id="form-${layout.id}-title">${esc(layout.title)}</h2>
          <div class="${layout.className}">
            ${layout.fields.map((field) => fieldMarkup(layout.id, field)).join('')}
            ${layout.radios ? radiosMarkup(layout.id, layout.radios) : ''}
            <div class="field"><button type="submit">${esc(layout.submit)}</button></div>
          </div>
          <div data-testid="form-${layout.id}-error"></div>
          <p role="status" class="result" data-testid="form-${layout.id}-result"></p>
        </form>
      `,
    ).join('')}</div>`,
  );
  root.append(view);

  for (const layout of LAYOUTS) {
    const form = q<HTMLFormElement>(view, `[data-testid="form-${layout.id}"]`);
    const errorBox = q(form, `[data-testid="form-${layout.id}-error"]`);
    const result = q(form, `[data-testid="form-${layout.id}-result"]`);
    const previous = latest.get(layout.id);
    if (previous) result.textContent = `Submitted: ${summarize(previous.values)}`;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorBox.innerHTML = '';
      const values: FormValues = {};
      for (const field of layout.fields) {
        const input = q<HTMLInputElement>(form, `[name="${field.key}"]`);
        values[field.key] = field.kind === 'checkbox' ? input.checked : input.value.trim();
      }
      if (layout.radios) {
        const checked = form.querySelector<HTMLInputElement>(`input[name="${layout.radios.key}"]:checked`);
        values[layout.radios.key] = checked?.value ?? '';
      }
      const problem = validate(layout, values);
      if (problem) {
        errorBox.append(html(`<p role="alert" class="error">${esc(problem)}</p>`));
        return;
      }
      const submit = q<HTMLButtonElement>(form, 'button[type="submit"]');
      submit.disabled = true;
      const saved = await api.forms.submit(layout.id, values);
      submit.disabled = false;
      if (saved.status === 201 && saved.data) {
        result.textContent = `Submitted: ${summarize(saved.data.values)}`;
        form.reset();
      } else {
        errorBox.append(html('<p role="alert" class="error">Could not save the form</p>'));
      }
    });
  }
};

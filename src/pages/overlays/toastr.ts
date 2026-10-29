import { q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';
import { showToast, type ToastPosition, type ToastType } from '../../ui/toast';

const TYPES: ToastType[] = ['success', 'info', 'warning', 'danger'];
const RANDOM_TITLES = ['Saved', 'Heads up', 'Almost there', 'Something went wrong'];

/** A form that configures a toast, and two buttons that show one. */
export const toastrPage: Page = (root) => {
  const view = page(
    'Toastr',
    '時間が経つと消える通知です。トーストは status（danger は alert）として現れ、"Dismiss" ボタンで閉じられます。同じトーストを 2 回出すと status が 2 つになるので、絞り込みが必要になります。',
    `
      <form class="card grid-2" data-testid="toast-form">
        <div class="field">
          <label for="toast-position">Position</label>
          <select id="toast-position" name="position">
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
          </select>
        </div>
        <div class="field">
          <label for="toast-type">Type</label>
          <select id="toast-type" name="type">
            ${TYPES.map((type) => `<option value="${type}">${type}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="toast-title">Title</label>
          <input id="toast-title" name="title" type="text" value="HI there!" autocomplete="off" />
        </div>
        <div class="field">
          <label for="toast-message">Message</label>
          <input id="toast-message" name="message" type="text" value="I'm cool toaster!" autocomplete="off" />
        </div>
        <div class="field">
          <label for="toast-duration">Duration (ms)</label>
          <input id="toast-duration" name="duration" type="number" min="0" step="500" value="5000" />
        </div>
        <div class="field field-inline">
          <input id="toast-prevent" name="preventDuplicates" type="checkbox" />
          <label for="toast-prevent">Prevent duplicates</label>
        </div>
        <div class="row span-2">
          <button type="submit" data-testid="show-toast">Show toast</button>
          <button type="button" data-testid="random-toast">Random toast</button>
        </div>
      </form>
    `,
  );
  root.append(view);

  const form = q<HTMLFormElement>(view, 'form');
  const read = () => ({
    position: q<HTMLSelectElement>(form, '#toast-position').value as ToastPosition,
    type: q<HTMLSelectElement>(form, '#toast-type').value as ToastType,
    title: q<HTMLInputElement>(form, '#toast-title').value,
    message: q<HTMLInputElement>(form, '#toast-message').value,
    duration: Number(q<HTMLInputElement>(form, '#toast-duration').value) || 0,
    preventDuplicates: q<HTMLInputElement>(form, '#toast-prevent').checked,
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showToast(read());
  });

  q(view, '[data-testid="random-toast"]').addEventListener('click', () => {
    const index = Math.floor(Math.random() * TYPES.length);
    showToast({
      ...read(),
      type: TYPES[index] ?? 'info',
      title: RANDOM_TITLES[index] ?? 'Toast',
      message: `Random toast #${Math.floor(Math.random() * 1000)}`,
    });
  });
};

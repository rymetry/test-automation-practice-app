import { html, q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';

/** Non-modal windows: several can be open at once, each a `dialog` named by its title bar. */
export const windowPage: Page = (root) => {
  const view = page(
    'Window',
    '背景を暗くしない小さな窓です。同時に 2 つ開けるので、"Window form" と "Window with text" という dialog の名前で区別します。タイトルバーのアイコンボタンには Minimize / Maximize / Close という名前が付いています。',
    `
      <div class="row">
        <button type="button" data-testid="open-window-form">Open window form</button>
        <button type="button" data-testid="open-window-text">Open window with text</button>
      </div>
      <p role="status" class="result" data-testid="window-result"></p>
      <div data-slot="windows"></div>
    `,
  );
  root.append(view);

  const result = q(view, '[data-testid="window-result"]');
  const slot = q(view, '[data-slot="windows"]');

  function createWindow(id: string, title: string, body: string): HTMLDialogElement {
    const win = html<HTMLDialogElement>(`
      <dialog class="window" aria-labelledby="${id}-title" data-testid="${id}">
        <div class="window-bar">
          <h2 id="${id}-title">${title}</h2>
          <button type="button" class="btn-icon btn-ghost btn-sm" aria-label="Minimize" aria-pressed="false">–</button>
          <button type="button" class="btn-icon btn-ghost btn-sm" aria-label="Maximize" aria-pressed="false">□</button>
          <button type="button" class="btn-icon btn-ghost btn-sm" aria-label="Close">×</button>
        </div>
        <div class="window-body">${body}</div>
      </dialog>
    `);
    const content = q(win, '.window-body');
    const minimize = q<HTMLButtonElement>(win, '[aria-label="Minimize"]');
    const maximize = q<HTMLButtonElement>(win, '[aria-label="Maximize"]');
    minimize.addEventListener('click', () => {
      content.hidden = !content.hidden;
      minimize.setAttribute('aria-pressed', String(content.hidden));
    });
    maximize.addEventListener('click', () => {
      const on = win.classList.toggle('is-maximized');
      maximize.setAttribute('aria-pressed', String(on));
    });
    q(win, '[aria-label="Close"]').addEventListener('click', () => win.close());
    win.addEventListener('close', () => win.remove());
    return win;
  }

  function openWindow(id: string, title: string, body: string): HTMLDialogElement {
    const existing = slot.querySelector<HTMLDialogElement>(`[data-testid="${id}"]`);
    if (existing) {
      existing.focus();
      return existing;
    }
    const win = createWindow(id, title, body);
    slot.append(win);
    win.show();
    return win;
  }

  q(view, '[data-testid="open-window-form"]').addEventListener('click', () => {
    const win = openWindow(
      'window-form',
      'Window form',
      `
        <form class="stack stack-wide">
          <div class="field">
            <label for="window-subject">Subject</label>
            <input id="window-subject" name="subject" type="text" autocomplete="off" />
          </div>
          <div class="field">
            <label for="window-text">Text</label>
            <textarea id="window-text" name="text"></textarea>
          </div>
          <div class="row"><button type="submit">Send</button></div>
        </form>
      `,
    );
    const form = win.querySelector('form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const subject = q<HTMLInputElement>(form, '#window-subject').value.trim();
      result.textContent = `Sent: ${subject || '(no subject)'}`;
      win.close();
    });
  });

  q(view, '[data-testid="open-window-text"]').addEventListener('click', () => {
    openWindow(
      'window-text',
      'Window with text',
      '<p>こちらは文章だけの窓です。最小化すると本文が隠れ、最大化すると画面いっぱいに広がります。</p>',
    );
  });
};

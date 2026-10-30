import { q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';

/** Four modal dialogs that close in different ways. The outcome of each goes to one status line on the page. */
export const dialogPage: Page = (root) => {
  const view = page(
    'Dialog',
    'モーダルダイアログです。ボタン、背景クリック、Esc、フォーム送信のどれで閉じたかが下のステータスに出ます。閉じているダイアログは画面ツリーに現れません。',
    `
      <div class="row">
        <button type="button" data-testid="open-dialog">Open dialog</button>
        <button type="button" data-testid="open-backdrop-dialog">Open dialog with backdrop close</button>
        <button type="button" data-testid="open-no-esc-dialog">Open dialog without Esc</button>
        <button type="button" data-testid="open-name-dialog">Enter name</button>
      </div>
      <p role="status" class="result" data-testid="dialog-result"></p>

      <dialog aria-labelledby="dialog-basic-title" data-testid="dialog-basic">
        <h2 id="dialog-basic-title">Dialog</h2>
        <p>Esc キーか下のボタンで閉じます。背景をクリックしても閉じません。</p>
        <div class="row"><button type="button" class="btn-primary" data-action="close">Close</button></div>
      </dialog>

      <dialog aria-labelledby="dialog-backdrop-title" data-testid="dialog-backdrop" data-backdrop-close>
        <h2 id="dialog-backdrop-title">Dialog with backdrop close</h2>
        <p>背景をクリックしても閉じます。</p>
        <div class="row"><button type="button" class="btn-primary" data-action="close">Close</button></div>
      </dialog>

      <dialog aria-labelledby="dialog-no-esc-title" data-testid="dialog-no-esc" data-no-esc>
        <h2 id="dialog-no-esc-title">Dialog without Esc</h2>
        <p>Esc では閉じません。ボタンだけが出口です。</p>
        <div class="row"><button type="button" class="btn-primary" data-action="close">Close</button></div>
      </dialog>

      <dialog aria-labelledby="dialog-name-title" data-testid="dialog-name">
        <form method="dialog" class="stack">
          <h2 id="dialog-name-title">Enter your name</h2>
          <div class="field">
            <label for="dialog-name-input">Name</label>
            <input id="dialog-name-input" name="name" type="text" autocomplete="off" />
          </div>
          <div class="row">
            <button type="submit" value="submit">Submit</button>
            <button type="button" data-action="cancel">Cancel</button>
          </div>
        </form>
      </dialog>
    `,
  );
  root.append(view);

  const result = q(view, '[data-testid="dialog-result"]');
  const dialogs = view.querySelectorAll<HTMLDialogElement>('dialog');

  for (const dialog of dialogs) {
    dialog.querySelector('[data-action="close"]')?.addEventListener('click', () => dialog.close('button'));
    dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', () => dialog.close('cancel'));
    dialog.addEventListener('cancel', (event) => {
      // "cancel" fires for Esc. Record the Esc, or refuse it for the dialog that has no Esc.
      if (dialog.hasAttribute('data-no-esc')) event.preventDefault();
      else dialog.returnValue = 'escape';
    });
    if (dialog.hasAttribute('data-no-esc')) {
      // Chrome lets a second Esc through "cancel" without user activation; stop it at the keydown instead.
      dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') event.preventDefault();
      });
    }
    if (dialog.hasAttribute('data-backdrop-close')) {
      dialog.addEventListener('click', (event) => {
        // A click on the dialog's own padding also targets the dialog; only a click outside its box is the backdrop.
        const box = dialog.getBoundingClientRect();
        const outside =
          event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
        if (event.target === dialog && outside) dialog.close('backdrop');
      });
    }
    dialog.addEventListener('close', () => {
      const name = dialog.querySelector<HTMLInputElement>('input[name="name"]');
      if (name && dialog.returnValue === 'submit') {
        result.textContent = `Hello, ${name.value.trim() || 'stranger'}`;
        name.value = '';
        return;
      }
      const reasons: Record<string, string> = {
        button: 'Closed by button',
        backdrop: 'Closed by backdrop',
        escape: 'Closed by Escape',
        cancel: 'Cancelled',
      };
      result.textContent = reasons[dialog.returnValue] ?? `Closed (${dialog.returnValue})`;
      dialog.returnValue = '';
    });
  }

  const open = (testId: string, dialogId: string): void => {
    q(view, `[data-testid="${testId}"]`).addEventListener('click', () => {
      q<HTMLDialogElement>(view, `[data-testid="${dialogId}"]`).showModal();
    });
  };
  open('open-dialog', 'dialog-basic');
  open('open-backdrop-dialog', 'dialog-backdrop');
  open('open-no-esc-dialog', 'dialog-no-esc');
  open('open-name-dialog', 'dialog-name');
};

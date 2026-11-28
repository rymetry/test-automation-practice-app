import { useRef, useState, type JSX, type MouseEvent } from 'react';
import { PageLayout } from '../../ui/PageLayout';

const CLOSE_REASONS: Record<string, string> = {
  button: 'Closed by button',
  backdrop: 'Closed by backdrop',
  escape: 'Closed by Escape',
  cancel: 'Cancelled',
};

/** 閉じ方が異なる 4 種類のモーダルダイアログ。閉じた結果を 1 つのステータス欄へ出す。 */
export function DialogPage(): JSX.Element {
  const [result, setResult] = useState('');
  const [nameValue, setNameValue] = useState('');

  const basicRef = useRef<HTMLDialogElement>(null);
  const backdropRef = useRef<HTMLDialogElement>(null);
  const noEscRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLDialogElement>(null);

  const handleClose = (dialog: HTMLDialogElement): void => {
    if (dialog === nameRef.current && dialog.returnValue === 'submit') {
      setResult(`Hello, ${nameValue.trim() || 'stranger'}`);
      setNameValue('');
      dialog.returnValue = '';
      return;
    }
    setResult(CLOSE_REASONS[dialog.returnValue] ?? `Closed (${dialog.returnValue})`);
    dialog.returnValue = '';
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>): void => {
    const dialog = event.currentTarget;
    // ダイアログ本体のパディング上クリックでも target が dialog になるため、矩形外だけを背景とみなす。
    const box = dialog.getBoundingClientRect();
    const outside =
      event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    if (event.target === dialog && outside) dialog.close('backdrop');
  };

  return (
    <PageLayout
      title="Dialog"
      intro="モーダルダイアログです。ボタン、背景クリック、Esc、フォーム送信のどれで閉じたかが下のステータスに出ます。閉じているダイアログは画面ツリーに現れません。"
      size="medium"
    >
      <div className="card">
        <div className="row">
          <button type="button" data-testid="open-dialog" onClick={() => basicRef.current?.showModal()}>
            Open dialog
          </button>
          <button type="button" data-testid="open-backdrop-dialog" onClick={() => backdropRef.current?.showModal()}>
            Open dialog with backdrop close
          </button>
          <button type="button" data-testid="open-no-esc-dialog" onClick={() => noEscRef.current?.showModal()}>
            Open dialog without Esc
          </button>
          <button type="button" data-testid="open-name-dialog" onClick={() => nameRef.current?.showModal()}>
            Enter name
          </button>
        </div>
        <p role="status" className="result" data-testid="dialog-result">
          {result || null}
        </p>
      </div>

      <dialog
        ref={basicRef}
        aria-labelledby="dialog-basic-title"
        data-testid="dialog-basic"
        onCancel={(event) => {
          event.currentTarget.returnValue = 'escape';
        }}
        onClose={(event) => handleClose(event.currentTarget)}
      >
        <h2 id="dialog-basic-title">Dialog</h2>
        <p>Esc キーか下のボタンで閉じます。背景をクリックしても閉じません。</p>
        <div className="row">
          <button
            type="button"
            className="btn-primary"
            data-action="close"
            onClick={() => basicRef.current?.close('button')}
          >
            Close
          </button>
        </div>
      </dialog>

      <dialog
        ref={backdropRef}
        aria-labelledby="dialog-backdrop-title"
        data-testid="dialog-backdrop"
        data-backdrop-close=""
        onCancel={(event) => {
          event.currentTarget.returnValue = 'escape';
        }}
        onClick={handleBackdropClick}
        onClose={(event) => handleClose(event.currentTarget)}
      >
        <h2 id="dialog-backdrop-title">Dialog with backdrop close</h2>
        <p>背景をクリックしても閉じます。</p>
        <div className="row">
          <button
            type="button"
            className="btn-primary"
            data-action="close"
            onClick={() => backdropRef.current?.close('button')}
          >
            Close
          </button>
        </div>
      </dialog>

      <dialog
        ref={noEscRef}
        aria-labelledby="dialog-no-esc-title"
        data-testid="dialog-no-esc"
        data-no-esc=""
        onCancel={(event) => {
          event.preventDefault();
        }}
        onKeyDown={(event) => {
          // Chrome では 2 回目の Esc が user activation なしで cancel を素通りするため keydown でも抑止する。
          if (event.key === 'Escape') event.preventDefault();
        }}
        onClose={(event) => handleClose(event.currentTarget)}
      >
        <h2 id="dialog-no-esc-title">Dialog without Esc</h2>
        <p>Esc では閉じません。ボタンだけが出口です。</p>
        <div className="row">
          <button
            type="button"
            className="btn-primary"
            data-action="close"
            onClick={() => noEscRef.current?.close('button')}
          >
            Close
          </button>
        </div>
      </dialog>

      <dialog
        ref={nameRef}
        aria-labelledby="dialog-name-title"
        data-testid="dialog-name"
        onCancel={(event) => {
          event.currentTarget.returnValue = 'escape';
        }}
        onClose={(event) => handleClose(event.currentTarget)}
      >
        <form method="dialog" className="stack">
          <h2 id="dialog-name-title">Enter your name</h2>
          <div className="field">
            <label htmlFor="dialog-name-input">Name</label>
            <input
              id="dialog-name-input"
              name="name"
              type="text"
              autoComplete="off"
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
            />
          </div>
          <div className="row">
            <button type="submit" value="submit">
              Submit
            </button>
            <button type="button" data-action="cancel" onClick={() => nameRef.current?.close('cancel')}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </PageLayout>
  );
}


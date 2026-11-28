import { useEffect, useRef, useState, type FormEvent, type JSX, type ReactNode } from 'react';
import { PageLayout } from '../../ui/PageLayout';

type WindowKind = 'window-form' | 'window-text';

interface FloatingWindowProps {
  id: WindowKind;
  title: string;
  onClose: () => void;
  registerRef: (el: HTMLDialogElement | null) => void;
  children: ReactNode;
}

function FloatingWindow({ id, title, onClose, registerRef, children }: FloatingWindowProps): JSX.Element {
  const [minimized, setMinimized] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    // StrictMode の二重実行で閉じないよう cleanup で close() を呼ばず、未表示時のみ show() する。
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.show();
  }, []);

  return (
    <dialog
      ref={(el) => {
        dialogRef.current = el;
        registerRef(el);
      }}
      className={maximized ? 'window is-maximized' : 'window'}
      aria-labelledby={`${id}-title`}
      data-testid={id}
    >
      <div className="window-bar">
        <h2 id={`${id}-title`}>{title}</h2>
        <button
          type="button"
          className="btn-icon btn-ghost btn-sm"
          aria-label="Minimize"
          aria-pressed={minimized}
          onClick={() => setMinimized((prev) => !prev)}
        >
          –
        </button>
        <button
          type="button"
          className="btn-icon btn-ghost btn-sm"
          aria-label="Maximize"
          aria-pressed={maximized}
          onClick={() => setMaximized((prev) => !prev)}
        >
          □
        </button>
        <button type="button" className="btn-icon btn-ghost btn-sm" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="window-body" hidden={minimized}>
        {children}
      </div>
    </dialog>
  );
}

interface WindowFormContentProps {
  onSend: (subject: string) => void;
}

function WindowFormContent({ onSend }: WindowFormContentProps): JSX.Element {
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onSend(subject.trim());
  };

  return (
    <form className="stack stack-wide" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="window-subject">Subject</label>
        <input
          id="window-subject"
          name="subject"
          type="text"
          autoComplete="off"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="window-text">Text</label>
        <textarea id="window-text" name="text" value={text} onChange={(event) => setText(event.target.value)} />
      </div>
      <div className="row">
        <button type="submit">Send</button>
      </div>
    </form>
  );
}

/** 複数同時に開ける非モーダルウィンドウ。各ウィンドウはタイトルバーの見出し名を持つ dialog。 */
export function WindowPage(): JSX.Element {
  const [openWindows, setOpenWindows] = useState<WindowKind[]>([]);
  const [result, setResult] = useState('');
  const dialogRefs = useRef<Partial<Record<WindowKind, HTMLDialogElement | null>>>({});

  const openWindow = (kind: WindowKind): void => {
    if (openWindows.includes(kind)) {
      dialogRefs.current[kind]?.focus();
      return;
    }
    setOpenWindows((prev) => (prev.includes(kind) ? prev : [...prev, kind]));
  };

  const closeWindow = (kind: WindowKind): void => {
    setOpenWindows((prev) => prev.filter((item) => item !== kind));
  };

  const handleSend = (subject: string): void => {
    setResult(`Sent: ${subject || '(no subject)'}`);
    closeWindow('window-form');
  };

  return (
    <PageLayout
      title="Window"
      intro='背景を暗くしない小さな窓です。同時に 2 つ開けるので、"Window form" と "Window with text" という dialog の名前で区別します。タイトルバーのアイコンボタンには Minimize / Maximize / Close という名前が付いています。'
      size="medium"
    >
      <div className="card">
        <div className="row">
          <button type="button" data-testid="open-window-form" onClick={() => openWindow('window-form')}>
            Open window form
          </button>
          <button type="button" data-testid="open-window-text" onClick={() => openWindow('window-text')}>
            Open window with text
          </button>
        </div>
        <p role="status" className="result" data-testid="window-result">
          {result || null}
        </p>
      </div>
      <div data-slot="windows">
        {openWindows.map((kind) =>
          kind === 'window-form' ? (
            <FloatingWindow
              key={kind}
              id="window-form"
              title="Window form"
              onClose={() => closeWindow('window-form')}
              registerRef={(el) => {
                dialogRefs.current['window-form'] = el;
              }}
            >
              <WindowFormContent onSend={handleSend} />
            </FloatingWindow>
          ) : (
            <FloatingWindow
              key={kind}
              id="window-text"
              title="Window with text"
              onClose={() => closeWindow('window-text')}
              registerRef={(el) => {
                dialogRefs.current['window-text'] = el;
              }}
            >
              <p>こちらは文章だけの窓です。最小化すると本文が隠れ、最大化すると画面いっぱいに広がります。</p>
            </FloatingWindow>
          ),
        )}
      </div>
    </PageLayout>
  );
}


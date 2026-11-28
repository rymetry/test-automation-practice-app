import { Fragment, useRef, useState, type FormEvent, type JSX, type ToggleEvent } from 'react';
import { PageLayout } from '../../ui/PageLayout';
import { Tooltip, type Placement } from '../../ui/Tooltip';

const PLACEMENTS: { label: string; placement: Placement }[] = [
  { label: 'Top', placement: 'top' },
  { label: 'Right', placement: 'right' },
  { label: 'Bottom', placement: 'bottom' },
  { label: 'Left', placement: 'left' },
];

/** ポップオーバーをトリガーボタンの横に配置する。top layer に描画されるためビューポート座標を直接指定できる。 */
function position(button: HTMLElement, pop: HTMLElement, placement: Placement): void {
  const b = button.getBoundingClientRect();
  const p = pop.getBoundingClientRect();
  const gap = 8;
  let top = 0;
  let left = 0;
  if (placement === 'top') {
    top = b.top - p.height - gap;
    left = b.left + b.width / 2 - p.width / 2;
  } else if (placement === 'bottom') {
    top = b.bottom + gap;
    left = b.left + b.width / 2 - p.width / 2;
  } else if (placement === 'left') {
    top = b.top + b.height / 2 - p.height / 2;
    left = b.left - p.width - gap;
  } else {
    top = b.top + b.height / 2 - p.height / 2;
    left = b.right + gap;
  }
  // 画面外にはみ出す場合は上下を反転してからビューポート内にクランプする。
  if (placement === 'bottom' && top + p.height > window.innerHeight - gap) top = b.top - p.height - gap;
  if (placement === 'top' && top < gap) top = b.bottom + gap;
  top = Math.min(Math.max(gap, top), window.innerHeight - p.height - gap);
  left = Math.min(Math.max(gap, left), window.innerWidth - p.width - gap);
  pop.style.position = 'fixed';
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
}

/** 4 方向の標準 Popover API、ホバー表示、フォーム付きポップオーバーのページ。 */
export function PopoverPage(): JSX.Element {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');

  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const formPopRef = useRef<HTMLDivElement>(null);

  const handleToggle = (key: string, placement: Placement, event: ToggleEvent<HTMLDivElement>): void => {
    const open = event.newState === 'open';
    setExpanded((prev) => ({ ...prev, [key]: open }));
    const button = buttonRefs.current[key];
    if (open && button) {
      position(button, event.currentTarget, placement);
    }
  };

  const handleFormSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setResult(`Sent to ${recipients.trim() || '(nobody)'}`);
    formPopRef.current?.hidePopover();
  };

  return (
    <PageLayout
      title="Popover"
      intro='クリックで開く吹き出しです。ブラウザ標準の Popover API を使っていて、開いている間だけ "Popover" という名前の dialog が存在します。ボタンの aria-expanded が開閉状態を表します。'
      size="medium"
    >
      <section className="card" aria-labelledby="placement-title">
        <h2 id="placement-title">Popover position</h2>
        <div className="placement-grid">
          {PLACEMENTS.map(({ label, placement }) => (
            <Fragment key={placement}>
              <button
                ref={(el) => {
                  buttonRefs.current[placement] = el;
                }}
                type="button"
                popoverTarget={`pop-${placement}`}
                aria-expanded={Boolean(expanded[placement])}
                data-testid={`popover-${placement}`}
              >
                {label}
              </button>
              <div
                id={`pop-${placement}`}
                popover="auto"
                role="dialog"
                aria-label="Popover"
                data-placement={placement}
                onToggle={(event) => handleToggle(placement, placement, event)}
              >
                Hello, how are you today?
              </div>
            </Fragment>
          ))}
        </div>
      </section>

      <div className="grid-2 grid-2-stretch">
        <section className="card" aria-labelledby="hover-title">
          <h2 id="hover-title">Popover on hover</h2>
          <Tooltip text="Popover on hover" placement="top" testId="popover-hover">
            Show on hover
          </Tooltip>
        </section>

        <section className="card" aria-labelledby="form-popover-title">
          <h2 id="form-popover-title">Popover with form</h2>
          <button
            ref={(el) => {
              buttonRefs.current.form = el;
            }}
            type="button"
            popoverTarget="pop-form"
            aria-expanded={Boolean(expanded.form)}
            data-testid="popover-form"
          >
            Open form popover
          </button>
          <div
            ref={formPopRef}
            id="pop-form"
            popover="auto"
            role="dialog"
            aria-labelledby="pop-form-heading"
            data-placement="bottom"
            onToggle={(event) => handleToggle('form', 'bottom', event)}
          >
            <form className="stack stack-wide" onSubmit={handleFormSubmit}>
              <h3 id="pop-form-heading">Send a message</h3>
              <div className="field">
                <label htmlFor="pop-recipients">Recipients</label>
                <input
                  id="pop-recipients"
                  name="recipients"
                  type="text"
                  autoComplete="off"
                  value={recipients}
                  onChange={(event) => setRecipients(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="pop-subject">Subject</label>
                <input
                  id="pop-subject"
                  name="subject"
                  type="text"
                  autoComplete="off"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="pop-message">Message</label>
                <textarea
                  id="pop-message"
                  name="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </div>
              <div className="row">
                <button type="submit">Send</button>
              </div>
            </form>
          </div>
          <p role="status" className="result" data-testid="popover-result">
            {result || null}
          </p>
        </section>
      </div>
    </PageLayout>
  );
}


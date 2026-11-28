import { useState, type FormEvent, type JSX } from 'react';
import { PageLayout } from '../../ui/PageLayout';
import {
  ToastPortal,
  useToasts,
  type ToastOptions,
  type ToastPosition,
  type ToastType,
} from '../../ui/ToastPortal';

const TYPES: ToastType[] = ['success', 'info', 'warning', 'danger'];
const RANDOM_TITLES = ['Saved', 'Heads up', 'Almost there', 'Something went wrong'];

/** トースト設定フォームと表示ボタンのページ。離脱時は useToasts と ToastPortal のアンマウントで即時破棄される。 */
export function ToastrPage(): JSX.Element {
  const [position, setPosition] = useState<ToastPosition>('top-right');
  const [type, setType] = useState<ToastType>('success');
  const [title, setTitle] = useState('HI there!');
  const [message, setMessage] = useState("I'm cool toaster!");
  const [duration, setDuration] = useState('5000');
  const [preventDuplicates, setPreventDuplicates] = useState(false);

  const { toasts, showToast, dismissToast } = useToasts();

  const currentOptions = (): ToastOptions => ({
    position,
    type,
    title,
    message,
    duration: Number(duration) || 0,
    preventDuplicates,
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    showToast(currentOptions());
  };

  const handleRandomToast = (): void => {
    const index = Math.floor(Math.random() * TYPES.length);
    showToast({
      ...currentOptions(),
      type: TYPES[index] ?? 'info',
      title: RANDOM_TITLES[index] ?? 'Toast',
      message: `Random toast #${Math.floor(Math.random() * 1000)}`,
    });
  };

  return (
    <PageLayout
      title="Toastr"
      intro='時間が経つと消える通知です。トーストは status（danger は alert）として現れ、"Dismiss" ボタンで閉じられます。同じトーストを 2 回出すと status が 2 つになるので、絞り込みが必要になります。'
      size="medium"
    >
      <form className="card grid-2" data-testid="toast-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="toast-position">Position</label>
          <select
            id="toast-position"
            name="position"
            value={position}
            onChange={(event) => setPosition(event.target.value as ToastPosition)}
          >
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="toast-type">Type</label>
          <select
            id="toast-type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as ToastType)}
          >
            {TYPES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="toast-title">Title</label>
          <input
            id="toast-title"
            name="title"
            type="text"
            autoComplete="off"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="toast-message">Message</label>
          <input
            id="toast-message"
            name="message"
            type="text"
            autoComplete="off"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="toast-duration">Duration (ms)</label>
          <input
            id="toast-duration"
            name="duration"
            type="number"
            min="0"
            step="500"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </div>
        <div className="field field-inline">
          <input
            id="toast-prevent"
            name="preventDuplicates"
            type="checkbox"
            checked={preventDuplicates}
            onChange={(event) => setPreventDuplicates(event.target.checked)}
          />
          <label htmlFor="toast-prevent">Prevent duplicates</label>
        </div>
        <div className="row span-2">
          <button type="submit" data-testid="show-toast">
            Show toast
          </button>
          <button type="button" data-testid="random-toast" onClick={handleRandomToast}>
            Random toast
          </button>
        </div>
      </form>
      <ToastPortal toasts={toasts} onDismiss={dismissToast} />
    </PageLayout>
  );
}


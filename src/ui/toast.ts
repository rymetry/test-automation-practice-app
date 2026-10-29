import { esc, html, q } from '../dom';

export type ToastType = 'success' | 'info' | 'warning' | 'danger';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface ToastOptions {
  title: string;
  message: string;
  type: ToastType;
  position: ToastPosition;
  /** Milliseconds until the toast removes itself; 0 keeps it until dismissed. */
  duration: number;
  /** Skip the toast when one with the same title and message is still showing. */
  preventDuplicates: boolean;
}

const containers = new Map<ToastPosition, HTMLElement>();

/**
 * Shows a toast. Each toast is a `status` (an `alert` for danger) with a "Dismiss" button. The container exists only
 * while toasts are showing, so pages without toasts have no extra live regions.
 */
export function showToast(options: ToastOptions): void {
  let container = containers.get(options.position);
  if (!container) {
    container = html(`<div class="toasts toasts-${options.position}" data-testid="toasts"></div>`);
    document.body.append(container);
    containers.set(options.position, container);
  }

  if (options.preventDuplicates) {
    for (const existing of container.querySelectorAll<HTMLElement>('.toast')) {
      if (existing.dataset.title === options.title && existing.dataset.message === options.message) return;
    }
  }

  const role = options.type === 'danger' ? 'alert' : 'status';
  const toast = html(`
    <div role="${role}" class="toast toast-${options.type}" data-testid="toast" data-type="${options.type}">
      <strong>${esc(options.title)}</strong>
      <button type="button" class="btn-icon btn-ghost btn-sm" aria-label="Dismiss">×</button>
      <p>${esc(options.message)}</p>
    </div>
  `);
  toast.dataset.title = options.title;
  toast.dataset.message = options.message;

  const remove = (): void => {
    clearTimeout(timer);
    toast.remove();
    if (container && container.childElementCount === 0) {
      container.remove();
      containers.delete(options.position);
    }
  };
  const timer = options.duration > 0 ? setTimeout(remove, options.duration) : undefined;
  q(toast, 'button').addEventListener('click', remove);
  container.append(toast);
}

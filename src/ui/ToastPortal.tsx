import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'info' | 'warning' | 'danger';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export interface ToastOptions {
  title: string;
  message: string;
  type: ToastType;
  position: ToastPosition;
  duration: number;
  preventDuplicates: boolean;
}

export interface ToastItem extends ToastOptions {
  id: number;
}

export interface ToastPortalProps {
  toasts: readonly ToastItem[];
  onDismiss: (id: number) => void;
}

const POSITIONS: readonly ToastPosition[] = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];

/** トースト一覧と自動消去タイマーを管理するフック。アンマウント時に全タイマーを破棄する。 */
export function useToasts(): {
  toasts: readonly ToastItem[];
  showToast: (options: ToastOptions) => void;
  dismissToast: (id: number) => void;
} {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);
  const nextIdRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: number): void => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    const next = toastsRef.current.filter((toast) => toast.id !== id);
    toastsRef.current = next;
    setToasts(next);
  }, []);

  const showToast = useCallback(
    (options: ToastOptions): void => {
      if (
        options.preventDuplicates &&
        toastsRef.current.some(
          (existing) =>
            existing.position === options.position &&
            existing.title === options.title &&
            existing.message === options.message,
        )
      ) {
        return;
      }

      const id = ++nextIdRef.current;
      const item: ToastItem = { ...options, id };
      const next = [...toastsRef.current, item];
      toastsRef.current = next;
      setToasts(next);

      if (options.duration > 0) {
        const timer = setTimeout(() => {
          dismissToast(id);
        }, options.duration);
        timersRef.current.set(id, timer);
      }
    },
    [dismissToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      toastsRef.current = [];
    };
  }, []);

  return { toasts, showToast, dismissToast };
}

/**
 * 表示中のトーストが存在する position ごとに document.body 直下へコンテナを描画する。
 * 0 件のときは DOM を残さず、他ページに余分なライブリージョンを出さない。
 */
export function ToastPortal({ toasts, onDismiss }: ToastPortalProps): JSX.Element | null {
  if (toasts.length === 0) return null;

  const activePositions = POSITIONS.filter((position) => toasts.some((toast) => toast.position === position));

  return createPortal(
    <>
      {activePositions.map((position) => (
        <div key={position} className={`toasts toasts-${position}`} data-testid="toasts">
          {toasts
            .filter((toast) => toast.position === position)
            .map((toast) => (
              <div
                key={toast.id}
                role={toast.type === 'danger' ? 'alert' : 'status'}
                className={`toast toast-${toast.type}`}
                data-testid="toast"
                data-type={toast.type}
                data-title={toast.title}
                data-message={toast.message}
              >
                <strong>{toast.title}</strong>
                <button
                  type="button"
                  className="btn-icon btn-ghost btn-sm"
                  aria-label="Dismiss"
                  onClick={() => onDismiss(toast.id)}
                >
                  ×
                </button>
                <p>{toast.message}</p>
              </div>
            ))}
        </div>
      ))}
    </>,
    document.body,
  );
}

import { useId, useState, type JSX, type ReactNode } from 'react';

export type Placement = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipProps {
  text: string;
  placement?: Placement;
  testId?: string;
  children: ReactNode;
}

/**
 * ボタンにツールチップを付与する部品。ホバーまたはキーボードフォーカスで表示し、Escape で閉じる。
 * 外側の span ではなく内側の button 自体に aria-describedby と開閉イベントを付ける。
 */
export function Tooltip({ text, placement = 'top', testId, children }: TooltipProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="tooltip-anchor">
      <button
        type="button"
        data-testid={testId}
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        {children}
      </button>
      <div role="tooltip" id={id} className={`tooltip tooltip-${placement}`} hidden={!open}>
        {text}
      </div>
    </span>
  );
}

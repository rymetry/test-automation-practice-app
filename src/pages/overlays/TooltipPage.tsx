import type { JSX } from 'react';
import type { Page } from '../../router';
import { mountReact } from '../../ui/mount-react';
import { PageLayout } from '../../ui/PageLayout';
import { Tooltip, type Placement } from '../../ui/Tooltip';

const PLACEMENTS: { label: string; placement: Placement }[] = [
  { label: 'Top', placement: 'top' },
  { label: 'Right', placement: 'right' },
  { label: 'Bottom', placement: 'bottom' },
  { label: 'Left', placement: 'left' },
];

/** 4 方向とアイコン付きボタンのツールチップ練習ページ。ホバーまたはフォーカスで表示する。 */
export function TooltipPage(): JSX.Element {
  return (
    <PageLayout
      title="Tooltip"
      intro="ホバーかキーボードフォーカスで出る短い説明です。tooltip ロールを持ち、ボタンと aria-describedby で結ばれています。出ていない間は画面ツリーにありません。"
      size="medium"
    >
      <section className="card" aria-labelledby="tooltip-placement-title">
        <h2 id="tooltip-placement-title">Tooltip placements</h2>
        <div className="placement-grid">
          {PLACEMENTS.map(({ label, placement }) => (
            <Tooltip
              key={placement}
              text={`Tooltip on ${placement}`}
              placement={placement}
              testId={`tooltip-${placement}`}
            >
              {label}
            </Tooltip>
          ))}
        </div>
      </section>
      <section className="card" aria-labelledby="tooltip-icon-title">
        <h2 id="tooltip-icon-title">Tooltip with icon</h2>
        <Tooltip text="This is a tooltip" placement="right" testId="tooltip-icon">
          <span aria-hidden="true">ⓘ</span> With icon
        </Tooltip>
      </section>
    </PageLayout>
  );
}

export const tooltipPage: Page = mountReact(TooltipPage);

import { q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';
import { attachTooltip, type Placement } from '../../ui/tooltip';

const PLACEMENTS: { label: string; placement: Placement }[] = [
  { label: 'Top', placement: 'top' },
  { label: 'Right', placement: 'right' },
  { label: 'Bottom', placement: 'bottom' },
  { label: 'Left', placement: 'left' },
];

/** Tooltips in four directions plus one on an icon button. Hover or focus shows them. */
export const tooltipPage: Page = (root) => {
  const view = page(
    'Tooltip',
    'ホバーかキーボードフォーカスで出る短い説明です。tooltip ロールを持ち、ボタンと aria-describedby で結ばれています。出ていない間は画面ツリーにありません。',
    `
      <section class="card" aria-labelledby="tooltip-placement-title">
        <h2 id="tooltip-placement-title">Tooltip placements</h2>
        <div class="placement-grid">
          ${PLACEMENTS.map(
            ({ label, placement }) => `<button type="button" data-testid="tooltip-${placement}">${label}</button>`,
          ).join('')}
        </div>
      </section>
      <section class="card" aria-labelledby="tooltip-icon-title">
        <h2 id="tooltip-icon-title">Tooltip with icon</h2>
        <button type="button" data-testid="tooltip-icon"><span aria-hidden="true">ⓘ</span> With icon</button>
      </section>
    `,
  );
  root.append(view);

  for (const { placement } of PLACEMENTS) {
    attachTooltip(q(view, `[data-testid="tooltip-${placement}"]`), `Tooltip on ${placement}`, placement);
  }
  attachTooltip(q(view, '[data-testid="tooltip-icon"]'), 'This is a tooltip', 'right');
};

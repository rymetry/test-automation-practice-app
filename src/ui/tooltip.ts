import { esc, html } from '../dom';

export type Placement = 'top' | 'right' | 'bottom' | 'left';

let counter = 0;

/**
 * Adds a tooltip to a control. The tooltip is a `tooltip` linked by aria-describedby and appears on hover and on
 * keyboard focus; Escape hides it. The control is wrapped so the tooltip can be positioned against it.
 */
export function attachTooltip(target: HTMLElement, text: string, placement: Placement = 'top'): HTMLElement {
  const id = `tooltip-${++counter}`;
  const wrapper = html('<span class="tooltip-anchor"></span>');
  target.replaceWith(wrapper);
  wrapper.append(target);
  const tip = html(`<div role="tooltip" id="${id}" class="tooltip tooltip-${placement}" hidden>${esc(text)}</div>`);
  wrapper.append(tip);
  target.setAttribute('aria-describedby', id);

  const show = (): void => {
    tip.hidden = false;
  };
  const hide = (): void => {
    tip.hidden = true;
  };
  target.addEventListener('mouseenter', show);
  target.addEventListener('mouseleave', hide);
  target.addEventListener('focus', show);
  target.addEventListener('blur', hide);
  target.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
  return tip;
}

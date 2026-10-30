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

/** Places a popover next to its button. Popovers sit in the top layer, so viewport coordinates work. */
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
  // Keep the popover inside the viewport: flip above the button when there is no room below, then clamp.
  if (placement === 'bottom' && top + p.height > window.innerHeight - gap) top = b.top - p.height - gap;
  if (placement === 'top' && top < gap) top = b.bottom + gap;
  top = Math.min(Math.max(gap, top), window.innerHeight - p.height - gap);
  left = Math.min(Math.max(gap, left), window.innerWidth - p.width - gap);
  pop.style.position = 'fixed';
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;
}

/** Click popovers in four directions (native Popover API), a hover one, and one with a form. */
export const popoverPage: Page = (root) => {
  const view = page(
    'Popover',
    'クリックで開く吹き出しです。ブラウザ標準の Popover API を使っていて、開いている間だけ "Popover" という名前の dialog が存在します。ボタンの aria-expanded が開閉状態を表します。',
    `
      <section class="card" aria-labelledby="placement-title">
        <h2 id="placement-title">Popover position</h2>
        <div class="placement-grid">
          ${PLACEMENTS.map(
            ({ label, placement }) => `
              <button type="button" popovertarget="pop-${placement}" aria-expanded="false" data-testid="popover-${placement}">${label}</button>
              <div id="pop-${placement}" popover role="dialog" aria-label="Popover" data-placement="${placement}">Hello, how are you today?</div>
            `,
          ).join('')}
        </div>
      </section>

      <section class="card" aria-labelledby="hover-title">
        <h2 id="hover-title">Popover on hover</h2>
        <button type="button" data-testid="popover-hover">Show on hover</button>
      </section>

      <section class="card" aria-labelledby="form-popover-title">
        <h2 id="form-popover-title">Popover with form</h2>
        <button type="button" popovertarget="pop-form" aria-expanded="false" data-testid="popover-form">Open form popover</button>
        <div id="pop-form" popover role="dialog" aria-labelledby="pop-form-heading" data-placement="bottom">
          <form class="stack">
            <h3 id="pop-form-heading">Send a message</h3>
            <div class="field">
              <label for="pop-recipients">Recipients</label>
              <input id="pop-recipients" name="recipients" type="text" autocomplete="off" />
            </div>
            <div class="field">
              <label for="pop-subject">Subject</label>
              <input id="pop-subject" name="subject" type="text" autocomplete="off" />
            </div>
            <div class="field">
              <label for="pop-message">Message</label>
              <textarea id="pop-message" name="message"></textarea>
            </div>
            <div class="row"><button type="submit">Send</button></div>
          </form>
        </div>
        <p role="status" class="result" data-testid="popover-result"></p>
      </section>
    `,
  );
  root.append(view);

  for (const pop of view.querySelectorAll<HTMLElement>('[popover]')) {
    const button = q<HTMLButtonElement>(view, `[popovertarget="${pop.id}"]`);
    const placement = (pop.dataset.placement ?? 'bottom') as Placement;
    pop.addEventListener('toggle', (event) => {
      const open = (event as ToggleEvent).newState === 'open';
      button.setAttribute('aria-expanded', String(open));
      if (open) position(button, pop, placement);
    });
  }

  attachTooltip(q(view, '[data-testid="popover-hover"]'), 'Popover on hover', 'top');

  const formPop = q<HTMLElement>(view, '#pop-form');
  const result = q(view, '[data-testid="popover-result"]');
  q<HTMLFormElement>(formPop, 'form').addEventListener('submit', (event) => {
    event.preventDefault();
    const recipients = q<HTMLInputElement>(formPop, '#pop-recipients').value.trim();
    result.textContent = `Sent to ${recipients || '(nobody)'}`;
    formPop.hidePopover();
  });
};

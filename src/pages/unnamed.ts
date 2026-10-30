import { q } from '../dom';
import type { Page } from '../router';
import { page } from '../ui/page';

/**
 * The one page that breaks the rules on purpose: icon buttons without names, an input without a label, a div that acts
 * as a button, a table without headers, a link without href, and a result without a live region.
 */
export const unnamedPage: Page = (root) => {
  const view = page(
    'Unnamed elements',
    'このページだけ、わざと名前の無い部品を置いています。getByRole に名前を渡せないので、順番、テキスト、data-testid、親要素からの絞り込みなど、名前以外の手がかりで指す練習に使ってください。他のページはすべて名前が付いています。',
    `
      <section class="card">
        <h2>Icon buttons</h2>
        <p class="muted">3 つとも aria-label がありません。</p>
        <div class="row">
          <button type="button" class="btn-icon">✎</button>
          <button type="button" class="btn-icon">✕</button>
          <button type="button" class="btn-icon">⚙</button>
        </div>
      </section>

      <section class="card">
        <h2>Input without a label</h2>
        <p class="muted">placeholder しかありません。</p>
        <input type="text" placeholder="Search..." />
      </section>

      <section class="card">
        <h2>Fake button</h2>
        <p class="muted">div にクリックハンドラを付けただけで、role も tabindex もありません。</p>
        <div class="btn" data-testid="fake-button">Click me</div>
        <p class="muted" data-testid="unnamed-result"></p>
      </section>

      <section class="card">
        <h2>Table without headers</h2>
        <table>
          <tbody>
            <tr><td>Mark</td><td>Otto</td><td>28</td></tr>
            <tr><td>Jacob</td><td>Thornton</td><td>45</td></tr>
            <tr><td>Larry</td><td>Bird</td><td>18</td></tr>
          </tbody>
        </table>
      </section>

      <section class="card">
        <h2>Link without href</h2>
        <p>詳しくは <a>Learn more</a> を参照（href が無いのでリンクのロールになりません）。</p>
      </section>
    `,
  );
  root.append(view);

  const fakeButton = q(view, '[data-testid="fake-button"]');
  const result = q(view, '[data-testid="unnamed-result"]');
  fakeButton.addEventListener('click', () => {
    result.textContent = 'Clicked';
  });
  for (const button of view.querySelectorAll<HTMLButtonElement>('.btn-icon')) {
    button.addEventListener('click', () => {
      result.textContent = `Clicked ${button.textContent}`;
    });
  }
};

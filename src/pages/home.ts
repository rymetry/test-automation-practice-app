import { esc, html, setTitle } from '../dom';
import { ALL_LINKS } from '../nav';
import type { Page } from '../router';

export const homePage: Page = (root) => {
  setTitle('Home');
  root.append(
    html(`
      <section>
        <h1>Todo App</h1>
        <p>
          テスト自動化を練習するために作った小さなアプリです。
          ここで行った操作はあなた専用のセッションに保存され、1 日経つと消えます。
        </p>
        <p>左のナビゲーションから、todo の一覧、サインイン、練習用ページと部品ごとのページを開けます。</p>
        <h2 id="pages-title">Pages</h2>
        <ul aria-labelledby="pages-title" class="card-grid" data-testid="pages">
          ${ALL_LINKS.map(
            (link) => `
              <li>
                <a href="${esc(link.href)}"><strong>${esc(link.label)}</strong><span>${esc(link.description)}</span></a>
              </li>
            `,
          ).join('')}
        </ul>
      </section>
    `),
  );
};

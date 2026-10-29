import { html, setTitle } from '../dom';
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
        <p>上のナビゲーションから、todo の一覧、サインイン、練習用ページを開けます。</p>
      </section>
    `),
  );
};

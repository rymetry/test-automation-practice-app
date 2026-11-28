import type { JSX } from 'react';
import { ALL_LINKS } from '../nav';
import type { Page } from '../router';
import { mountReact } from '../ui/mount-react';
import { useDocumentTitle } from '../ui/PageLayout';

export function HomePage(): JSX.Element {
  useDocumentTitle('Home');

  return (
    <section>
      <h1>Todo App</h1>
      <p>テスト自動化を練習するために作った小さなアプリです。 ここで行った操作はあなた専用のセッションに保存され、1 日経つと消えます。</p>
      <p>左のナビゲーションから、todo の一覧、サインイン、練習用ページと部品ごとのページを開けます。</p>
      <h2 id="pages-title">Pages</h2>
      <ul aria-labelledby="pages-title" className="card-grid" data-testid="pages">
        {ALL_LINKS.map((link) => (
          <li key={link.href}>
            <a href={link.href}>
              <strong>{link.label}</strong>
              <span>{link.description}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const homePage: Page = mountReact(HomePage);

import type { JSX } from 'react';
import { Link } from 'react-router';
import { ALL_LINKS } from '../nav';
import { useDocumentTitle } from '../ui/PageLayout';

export function HomePage(): JSX.Element {
  useDocumentTitle('Home');

  return (
    <section>
      <h1>Testing Sandbox</h1>
      <p>テストを練習するためのサンドボックスアプリです。ここで行った操作はあなた専用のセッションに保存され、1 日経つと消えます。</p>
      <p>左のナビゲーションから、todo の一覧、サインイン、練習用ページと部品ごとのページを開けます。</p>
      <h2 id="pages-title">Pages</h2>
      <ul aria-labelledby="pages-title" className="card-grid" data-testid="pages">
        {ALL_LINKS.map((link) => (
          <li key={link.href}>
            <Link to={link.href}>
              <strong>{link.label}</strong>
              <span>{link.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

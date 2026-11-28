import type { JSX } from 'react';
import type { Page } from '../router';
import { mountReact } from '../ui/mount-react';
import { useDocumentTitle } from '../ui/PageLayout';

export function NotFoundPage(): JSX.Element {
  useDocumentTitle('Not found');

  return (
    <section className="page-narrow">
      <h1>Page not found</h1>
      <div className="card">
        <p>
          <code>{location.pathname}</code> には何もありません。
        </p>
        <p>
          <a href="/">ホームに戻る</a>
        </p>
      </div>
    </section>
  );
}

export const notFoundPage: Page = mountReact(NotFoundPage);

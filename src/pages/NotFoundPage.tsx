import type { JSX } from 'react';
import { Link, useLocation } from 'react-router';
import { useDocumentTitle } from '../ui/PageLayout';

export function NotFoundPage(): JSX.Element {
  useDocumentTitle('Not found');
  const { pathname } = useLocation();

  return (
    <section className="page-narrow">
      <h1>Page not found</h1>
      <div className="card">
        <p>
          <code>{pathname}</code> には何もありません。
        </p>
        <p>
          <Link to="/">ホームに戻る</Link>
        </p>
      </div>
    </section>
  );
}

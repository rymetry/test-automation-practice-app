import { useLayoutEffect, type JSX, type ReactNode } from 'react';

export const SITE_TITLE = 'Testing Sandbox';

export type PageSize = 'narrow' | 'medium' | 'wide';

export interface PageLayoutProps {
  title: string;
  intro: string;
  size?: PageSize;
  children?: ReactNode;
}

export function useDocumentTitle(page: string): void {
  useLayoutEffect(() => {
    document.title = `${page} · ${SITE_TITLE}`;
  }, [page]);
}

/** 部品ページ共通の骨格（見出し、日本語の説明 1 段落、本文）。size で本文の最大幅を narrow / medium / wide に切り替える。 */
export function PageLayout({ title, intro, size = 'wide', children }: PageLayoutProps): JSX.Element {
  useDocumentTitle(title);
  const sectionClass = size === 'wide' ? undefined : `page-${size}`;
  return (
    <section className={sectionClass}>
      <h1>{title}</h1>
      <p className="page-intro">{intro}</p>
      {children}
    </section>
  );
}

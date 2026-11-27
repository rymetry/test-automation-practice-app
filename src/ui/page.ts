import { esc, html, setTitle } from '../dom';

export type PageSize = 'narrow' | 'medium' | 'wide';

/** 部品ページ共通の骨格（見出し、日本語の説明 1 段落、本文）。size で本文の最大幅を narrow / medium / wide に切り替える。 */
export function page(title: string, intro: string, body: string, size: PageSize = 'wide'): HTMLElement {
  setTitle(title);
  const sectionClass = size === 'wide' ? '' : ` class="page-${size}"`;
  return html(`
    <section${sectionClass}>
      <h1>${esc(title)}</h1>
      <p class="page-intro">${esc(intro)}</p>
      ${body}
    </section>
  `);
}

/** Formats a value list as "key=value, key=value" for result lines. */
export function summarize(values: Record<string, string | boolean>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(', ');
}

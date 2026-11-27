import { esc, html, setTitle } from '../dom';

export type PageSize = 'narrow' | 'medium' | 'wide';

/** The common skeleton of a component page: title, one paragraph of Japanese explanation, then the body markup. */
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

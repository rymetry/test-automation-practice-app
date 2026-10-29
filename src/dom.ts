/** Builds an element from an HTML string. The string must have exactly one top-level node. */
export function html<T extends HTMLElement = HTMLElement>(markup: string): T {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const node = template.content.firstElementChild;
  if (!node) throw new Error('html(): markup has no element');
  return node as T;
}

/** Escapes text for safe interpolation into an HTML string. */
export function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Finds a required element inside `root`. */
export function q<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) throw new Error(`q(): no element matches ${selector}`);
  return node;
}

export function setTitle(page: string): void {
  document.title = `${page} · Todo App`;
}

export type Cleanup = () => void;

/** Renders one page into `root`. May return a cleanup function that runs before the next page renders. */
export type Page = (root: HTMLElement) => void | Cleanup | Promise<void | Cleanup>;

const routes = new Map<string, Page>();
let notFound: Page = (root) => {
  root.innerHTML = '<h1>Not found</h1>';
};
let root: HTMLElement | null = null;
let cleanup: Cleanup | null = null;
let renderToken = 0;
const renderListeners: Array<() => void> = [];

export function route(path: string, page: Page): void {
  routes.set(path, page);
}

export function routeNotFound(page: Page): void {
  notFound = page;
}

/** Runs at the start of every page render (navigation, back/forward, first paint). */
export function onRender(listener: () => void): void {
  renderListeners.push(listener);
}

export function start(target: HTMLElement): void {
  root = target;

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as Element).closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.target && anchor.target !== '_self') return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  });

  window.addEventListener('popstate', () => {
    void render();
  });

  void render();
}

export function navigate(path: string): void {
  if (path === location.pathname + location.search + location.hash) {
    void render();
    return;
  }
  history.pushState(null, '', path);
  void render();
}

async function render(): Promise<void> {
  if (!root) return;
  const token = ++renderToken;

  cleanup?.();
  cleanup = null;
  for (const listener of renderListeners) listener();

  const page = routes.get(location.pathname) ?? notFound;
  root.innerHTML = '';
  const result = await page(root);

  // A navigation happened while this page was still rendering: its cleanup belongs to a page that is already gone.
  if (token !== renderToken) {
    if (typeof result === 'function') result();
    return;
  }
  if (typeof result === 'function') cleanup = result;
  root.focus({ preventScroll: true });
}

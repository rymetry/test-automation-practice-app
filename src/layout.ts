import { esc, html, q } from './dom';
import { COMPONENT_GROUPS, MAIN_LINKS, type NavLink } from './nav';
import { onRender } from './router';
import { mountThemeSelect } from './theme';

function linkItems(links: NavLink[]): string {
  return links.map((link) => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`).join('');
}

const BRAND_MARK_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.5" stroke="currentColor" stroke-width="1.4" opacity="0.35" /><path d="M4.5 8.25L6.85 10.6L11.5 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>';

/**
 * The admin shell: a sidebar with both navigations, a top bar with the theme select and the sign-in status,
 * and the <main> that pages render into. The "Main" navigation keeps its five original links.
 */
export function mountShell(app: HTMLElement): { main: HTMLElement; authStatus: HTMLElement } {
  const groups = COMPONENT_GROUPS.map(
    (group, index) => `
      <p class="nav-group-label" id="nav-group-${index}">${esc(group.label)}</p>
      <ul aria-labelledby="nav-group-${index}">${linkItems(group.links)}</ul>
    `,
  ).join('');

  const sidebar = html(`
    <aside class="sidebar" id="sidebar">
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">${BRAND_MARK_SVG}</span>Todo App</a>
      <nav aria-label="Main">
        <ul>${linkItems(MAIN_LINKS)}</ul>
      </nav>
      <nav aria-label="Components">${groups}</nav>
    </aside>
  `);

  const backdrop = html('<div class="sidebar-backdrop" aria-hidden="true" hidden></div>');

  const header = html(`
    <header class="site-header">
      <button type="button" class="menu-button btn-icon" aria-label="Open menu" aria-expanded="false" aria-controls="sidebar">☰</button>
      <div class="auth" data-testid="auth-status"></div>
    </header>
  `);
  const main = html('<main id="main" tabindex="-1"></main>');

  const menuButton = q<HTMLButtonElement>(header, '.menu-button');
  const authStatus = q(header, '[data-testid="auth-status"]');
  mountThemeSelect(header);
  header.append(authStatus); // theme first, sign-in status last

  function setMenu(open: boolean): void {
    sidebar.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
  }
  menuButton.addEventListener('click', () => setMenu(!sidebar.classList.contains('is-open')));
  backdrop.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
      setMenu(false);
      menuButton.focus();
    }
  });

  onRender(() => {
    setMenu(false);
    for (const anchor of sidebar.querySelectorAll<HTMLAnchorElement>('nav a')) {
      if (anchor.getAttribute('href') === location.pathname) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  });

  app.append(sidebar, backdrop, header, main);
  return { main, authStatus };
}

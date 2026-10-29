import { esc, html, q } from './dom';
import { COMPONENT_GROUPS, MAIN_LINKS, type NavLink } from './nav';
import { onRender } from './router';
import { mountThemeSelect } from './theme';

function linkItems(links: NavLink[]): string {
  return links.map((link) => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`).join('');
}

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
      <a class="brand" href="/"><span class="brand-mark" aria-hidden="true">✓</span>Todo App</a>
      <nav aria-label="Main">
        <ul>${linkItems(MAIN_LINKS)}</ul>
      </nav>
      <nav aria-label="Components">${groups}</nav>
    </aside>
  `);

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
    menuButton.setAttribute('aria-expanded', String(open));
  }
  menuButton.addEventListener('click', () => setMenu(!sidebar.classList.contains('is-open')));

  onRender(() => {
    setMenu(false);
    for (const anchor of sidebar.querySelectorAll<HTMLAnchorElement>('nav a')) {
      if (anchor.getAttribute('href') === location.pathname) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  });

  app.append(sidebar, header, main);
  return { main, authStatus };
}

import { esc, html, q } from './dom';
import { COMPONENT_GROUPS, MAIN_LINKS, type NavLink } from './nav';
import { onRender } from './router';
import { mountThemeToggle } from './theme';

function linkItems(links: NavLink[]): string {
  return links.map((link) => `<li><a href="${esc(link.href)}">${esc(link.label)}</a></li>`).join('');
}

const BRAND_MARK_SVG =
  '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.5" stroke="currentColor" stroke-width="1.4" opacity="0.35" /><path d="M4.5 8.25L6.85 10.6L11.5 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>';

const MENU_ICON_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" /></svg>';

const GITHUB_ICON_SVG =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" /></svg>';

interface PageContext {
  section: string;
  page: string;
}

const EXTRA_PAGE_CONTEXT: Record<string, PageContext> = {
  '/login': { section: 'Account', page: 'Sign in' },
};

function resolvePageContext(pathname: string): PageContext {
  for (const link of MAIN_LINKS) {
    if (link.href === pathname) return { section: 'Workspace', page: link.label };
  }
  for (const group of COMPONENT_GROUPS) {
    for (const link of group.links) {
      if (link.href === pathname) return { section: group.label, page: link.label };
    }
  }
  return EXTRA_PAGE_CONTEXT[pathname] ?? { section: 'Workspace', page: 'Page not found' };
}

/**
 * 共通の管理画面シェル（サイドバー、トップバー、メイン領域、フッター）をマウントする。
 * Main ナビゲーションの 5 項目と、共通シェルに status / region / dialog を置かない契約を維持する。
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
      <div class="site-header-inner">
        <div class="header-left">
          <button type="button" class="menu-button btn-icon btn-ghost" aria-label="Open menu" aria-expanded="false" aria-controls="sidebar">${MENU_ICON_SVG}</button>
          <div class="header-context" data-testid="header-context">
            <span class="header-section"></span>
            <span class="header-sep" aria-hidden="true">/</span>
            <span class="header-page"></span>
          </div>
        </div>
        <div class="header-actions">
          <span class="header-divider" aria-hidden="true"></span>
          <div class="auth" data-testid="auth-status"></div>
        </div>
      </div>
    </header>
  `);
  const main = html('<main id="main" tabindex="-1"></main>');
  const footer = html(`
    <footer class="site-footer">
      <div class="site-footer-inner">
        <div class="footer-info">
          <p class="footer-desc">テスト自動化（UI / API / E2E）を練習するための Todo アプリと UI 部品集。操作データは訪問者ごとのセッションに分離され、最長 24 時間で使えなくなります。</p>
          <p class="footer-copy">© 2026 rymetry · MIT License</p>
        </div>
        <div class="footer-links">
          <a
            class="btn btn-icon btn-ghost footer-github"
            href="https://github.com/rymetry/test-automation-practice-app"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub repository"
            title="GitHub repository"
            data-testid="github-link"
          >${GITHUB_ICON_SVG}</a>
        </div>
      </div>
    </footer>
  `);

  const menuButton = q<HTMLButtonElement>(header, '.menu-button');
  const contextSection = q(header, '.header-section');
  const contextPage = q(header, '.header-page');
  const headerActions = q(header, '.header-actions');
  const headerDivider = q(headerActions, '.header-divider');
  const authStatus = q(headerActions, '[data-testid="auth-status"]');
  mountThemeToggle(headerActions);
  headerActions.append(headerDivider, authStatus); // mountThemeToggle は末尾に追加するため、区切り線とサインイン状態を後ろへ付け直す

  function syncHeaderContext(): void {
    const context = resolvePageContext(location.pathname);
    contextSection.textContent = context.section;
    contextPage.textContent = context.page;
  }

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

  syncHeaderContext();
  onRender(() => {
    setMenu(false);
    syncHeaderContext();
    for (const anchor of sidebar.querySelectorAll<HTMLAnchorElement>('nav a')) {
      if (anchor.getAttribute('href') === location.pathname) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  });

  app.append(sidebar, backdrop, header, main, footer);
  return { main, authStatus };
}

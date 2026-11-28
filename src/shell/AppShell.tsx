import { Fragment, useEffect, useRef, useState, type JSX } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth';
import { COMPONENT_GROUPS, MAIN_LINKS } from '../nav';
import { AuthStatus } from './AuthStatus';
import { ThemeToggle } from './ThemeToggle';

interface PageContext {
  section: string;
  page: string;
}

const EXTRA_PAGE_CONTEXT: Record<string, PageContext> = {
  '/login': { section: 'Account', page: 'Sign in' },
  '/new-tab': { section: 'Overlays', page: 'New tab page' },
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
 * 共通の管理画面シェル（サイドバー、トップバー、メイン領域、フッター）。
 * #app の CSS Grid 構造を維持するため Fragment 直下に 5 要素を配置し、
 * Main ナビゲーション 5 項目と共通シェルへの status / region / dialog 非混入契約を守る。
 */
export function AppShell(): JSX.Element {
  const { ready } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const context = resolvePageContext(location.pathname);

  useEffect(() => {
    setMenuOpen(false);
    if (ready) {
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [location.key, ready]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <aside className={menuOpen ? 'sidebar is-open' : 'sidebar'} id="sidebar">
        <Link className="brand" to="/">
          <span className="brand-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
              <rect x="1.75" y="1.75" width="12.5" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
              <path
                d="M4.5 8.25L6.85 10.6L11.5 5.6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Testing Sandbox
        </Link>
        <nav aria-label="Main">
          <ul>
            {MAIN_LINKS.map((link) => (
              <li key={link.href}>
                <NavLink to={link.href} end caseSensitive>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Components">
          {COMPONENT_GROUPS.map((group, index) => (
            <Fragment key={group.label}>
              <p className="nav-group-label" id={`nav-group-${index}`}>
                {group.label}
              </p>
              <ul aria-labelledby={`nav-group-${index}`}>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <NavLink to={link.href} end caseSensitive>
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </Fragment>
          ))}
        </nav>
      </aside>

      <div className="sidebar-backdrop" aria-hidden="true" hidden={!menuOpen} onClick={() => setMenuOpen(false)} />

      <header className="site-header">
        <div className="site-header-inner">
          <div className="header-left">
            <button
              ref={menuButtonRef}
              type="button"
              className="menu-button btn-icon btn-ghost"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls="sidebar"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="header-context" data-testid="header-context">
              <span className="header-section">{context.section}</span>
              <span className="header-sep" aria-hidden="true">
                /
              </span>
              <span className="header-page">{context.page}</span>
            </div>
          </div>
          <div className="header-actions">
            <ThemeToggle />
            <span className="header-divider" aria-hidden="true" />
            <div className="auth" data-testid="auth-status">
              <AuthStatus />
            </div>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} ref={mainRef}>
        {ready ? (
          <Fragment key={location.key}>
            <Outlet />
          </Fragment>
        ) : null}
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-info">
            <p className="footer-desc">テストを練習するためのサンドボックスアプリ。操作データは訪問者ごとのセッションに分離され、最長 24 時間で使えなくなります。</p>
            <p className="footer-copy">© 2026 rymetry · MIT License</p>
          </div>
          <div className="footer-links">
            <a
              className="btn btn-icon btn-ghost footer-github"
              href="https://github.com/rymetry/testing-sandbox"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              title="GitHub repository"
              data-testid="github-link"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

import { useEffect, useState, type JSX } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DARK_MEDIA = '(prefers-color-scheme: dark)';

function systemTheme(): Theme {
  return window.matchMedia?.(DARK_MEDIA).matches ? 'dark' : 'light';
}

function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ストレージが利用できない場合は OS 設定にフォールバックする。
  }
  return null;
}

function documentTheme(): Theme | null {
  const current = document.documentElement.dataset.theme;
  return current === 'light' || current === 'dark' ? current : null;
}

function effectiveTheme(): Theme {
  return documentTheme() ?? storedTheme() ?? systemTheme();
}

function applyThemeToDocument(theme: Theme | null): void {
  if (theme === null) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

/** アイコンのみの Light / Dark トグルボタン（未設定時は OS 設定に従う）。 */
export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => effectiveTheme());

  useEffect(() => {
    applyThemeToDocument(storedTheme());
    setTheme(effectiveTheme());

    const onStorage = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      applyThemeToDocument(storedTheme());
      setTheme(effectiveTheme());
    };

    const media = window.matchMedia?.(DARK_MEDIA);
    const onMediaChange = (): void => {
      if (documentTheme() === null) {
        setTheme(effectiveTheme());
      }
    };

    window.addEventListener('storage', onStorage);
    media?.addEventListener('change', onMediaChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      media?.removeEventListener('change', onMediaChange);
    };
  }, []);

  function handleToggle(): void {
    const next: Theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
    applyThemeToDocument(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 永続化できなくても現在の画面には即時反映する。
    }
    setTheme(next);
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="btn-icon btn-ghost theme-toggle"
      aria-label="Dark mode"
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      data-testid="theme"
      onClick={handleToggle}
    >
      <svg
        className="theme-icon theme-icon-moon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
      <svg
        className="theme-icon theme-icon-sun"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    </button>
  );
}

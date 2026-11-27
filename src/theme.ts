import { html } from './dom';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';
const DARK_MEDIA = '(prefers-color-scheme: dark)';

let listening = false;

function systemTheme(): Theme {
  return window.matchMedia?.(DARK_MEDIA).matches ? 'dark' : 'light';
}

export function storedTheme(): Theme | null {
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

export function effectiveTheme(): Theme {
  return documentTheme() ?? storedTheme() ?? systemTheme();
}

function applyThemeToDocument(theme: Theme | null): void {
  if (theme === null) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

function syncToggleButton(button: HTMLButtonElement): void {
  const isDark = effectiveTheme() === 'dark';
  button.setAttribute('aria-pressed', String(isDark));
  button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}

function syncAllToggleButtons(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-testid="theme"]')) {
    syncToggleButton(button);
  }
}

export function applyTheme(theme: Theme): void {
  applyThemeToDocument(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 永続化できなくても現在の画面には即時反映する。
  }
  syncAllToggleButtons();
}

export function toggleTheme(): Theme {
  const next: Theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/** 保存済みテーマを適用し、別タブ・iframe からの storage 変更および未設定時の OS テーマ変更に追従する。 */
export function initTheme(): void {
  applyThemeToDocument(storedTheme());
  if (listening) return;
  listening = true;

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    applyThemeToDocument(storedTheme());
    syncAllToggleButtons();
  });

  const media = window.matchMedia?.(DARK_MEDIA);
  media?.addEventListener('change', () => {
    if (documentTheme() === null) syncAllToggleButtons();
  });
}

const MOON_SVG =
  '<svg class="theme-icon theme-icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>';

const SUN_SVG =
  '<svg class="theme-icon theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>';

/** アイコンのみの Light / Dark トグルボタンをマウントする（未設定時は OS 設定に従う）。 */
export function mountThemeToggle(target: HTMLElement): void {
  const button = html<HTMLButtonElement>(`
    <button
      type="button"
      class="btn-icon btn-ghost theme-toggle"
      aria-label="Dark mode"
      aria-pressed="false"
      data-testid="theme"
    >${MOON_SVG}${SUN_SVG}</button>
  `);
  syncToggleButton(button);
  button.addEventListener('click', () => {
    toggleTheme();
  });
  target.append(button);
}

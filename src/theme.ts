import { html, q } from './dom';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

export function currentTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked). The system theme is a fine default.
  }
  return 'system';
}

export function applyTheme(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not persisted; the choice still applies to this page.
  }
}

/** Applies the stored theme. index.html does the same before the first paint; this keeps the two in sync. */
export function initTheme(): void {
  applyTheme(currentTheme());
}

/** A labelled select: System / Light / Dark. */
export function mountThemeSelect(target: HTMLElement): void {
  const control = html(`
    <div class="theme-control">
      <label for="theme">Theme</label>
      <select id="theme" name="theme" data-testid="theme">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </div>
  `);
  const select = q<HTMLSelectElement>(control, 'select');
  select.value = currentTheme();
  select.addEventListener('change', () => applyTheme(select.value as Theme));
  target.append(control);
}

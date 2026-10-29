import { api } from './api';
import { esc, html } from './dom';
import { navigate } from './router';

let container: HTMLElement | null = null;
let currentUser: string | null = null;

export function mountAuthStatus(target: HTMLElement): void {
  container = target;
  render();
}

export function user(): string | null {
  return currentUser;
}

/** Asks the server who is signed in and redraws the header. */
export async function refreshAuth(): Promise<string | null> {
  const result = await api.me();
  currentUser = result.status === 200 ? (result.data?.username ?? null) : null;
  render();
  return currentUser;
}

function render(): void {
  if (!container) return;
  container.innerHTML = '';
  if (currentUser) {
    const status = html(`<p class="auth-user">Signed in as <strong>${esc(currentUser)}</strong></p>`);
    const button = html<HTMLButtonElement>('<button type="button" data-testid="sign-out">Sign out</button>');
    button.addEventListener('click', async () => {
      button.disabled = true;
      await api.logout();
      currentUser = null;
      render();
      navigate('/');
    });
    container.append(status, button);
  } else {
    container.append(html('<a href="/login" data-testid="sign-in-link">Sign in</a>'));
  }
}

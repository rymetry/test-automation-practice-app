import { api } from '../../api';
import { esc, html, q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';

/** Issues a password reset token. There is no email, so the token is shown on the page. */
export const requestPasswordPage: Page = (root) => {
  const view = page(
    'Request password',
    'メールアドレスを入れるとリセット用のトークンが発行されます。メールは送れないので、トークンはこの画面に表示します（alice のメールは alice@example.com）。',
    `
      <form class="stack card" data-testid="request-password-form" novalidate>
        <div class="field">
          <label for="request-email">Email</label>
          <input id="request-email" name="email" type="email" autocomplete="email" />
        </div>
        <div data-testid="request-error"></div>
        <div><button type="submit" data-testid="request-password">Request password</button></div>
      </form>
      <div class="result" role="status" data-testid="request-result"></div>
    `,
  );
  root.append(view);

  const form = q<HTMLFormElement>(view, 'form');
  const email = q<HTMLInputElement>(view, '#request-email');
  const errorBox = q(view, '[data-testid="request-error"]');
  const result = q(view, '[data-testid="request-result"]');
  const submit = q<HTMLButtonElement>(view, 'button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.innerHTML = '';
    result.innerHTML = '';
    if (!email.value.includes('@')) {
      errorBox.append(html('<p role="alert" class="error">Email must contain @</p>'));
      return;
    }
    submit.disabled = true;
    const response = await api.password.request(email.value.trim());
    submit.disabled = false;
    if (response.status === 200 && response.data && 'token' in response.data) {
      const token = response.data.token;
      result.append(
        html(`<span>Reset token: <code data-testid="reset-token">${esc(token)}</code></span>`),
        html(`<span> · <a href="/auth/reset-password?token=${encodeURIComponent(token)}">Continue to reset password</a></span>`),
      );
      return;
    }
    const message = response.data && 'error' in response.data ? response.data.error : 'Could not request a reset';
    errorBox.append(html(`<p role="alert" class="error">${esc(message)}</p>`));
  });

  email.focus();
};

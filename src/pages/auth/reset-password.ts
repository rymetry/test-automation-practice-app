import { api } from '../../api';
import { esc, html, q } from '../../dom';
import type { Page } from '../../router';
import { page } from '../../ui/page';

/** Sets a new password with a token from the Request password page (or the API). */
export const resetPasswordPage: Page = (root) => {
  const view = page(
    'Reset password',
    'Request password で受け取ったトークンで新しいパスワードを設定します。URL に ?token= が付いていれば入力欄に入ります。変更後はそのパスワードでサインインできます。',
    `
      <form class="stack card" data-testid="reset-password-form" novalidate>
        <div class="field">
          <label for="reset-token">Token</label>
          <input id="reset-token" name="token" type="text" autocomplete="off" />
        </div>
        <div class="field">
          <label for="reset-password">New password</label>
          <input id="reset-password" name="password" type="password" autocomplete="new-password" />
        </div>
        <div class="field">
          <label for="reset-confirm">Confirm password</label>
          <input id="reset-confirm" name="confirm" type="password" autocomplete="new-password" />
        </div>
        <div data-testid="reset-error"></div>
        <div><button type="submit" data-testid="change-password">Change password</button></div>
      </form>
      <div class="result" role="status" data-testid="reset-result"></div>
    `,
  );
  root.append(view);

  const form = q<HTMLFormElement>(view, 'form');
  const token = q<HTMLInputElement>(view, '#reset-token');
  const password = q<HTMLInputElement>(view, '#reset-password');
  const confirm = q<HTMLInputElement>(view, '#reset-confirm');
  const errorBox = q(view, '[data-testid="reset-error"]');
  const result = q(view, '[data-testid="reset-result"]');
  const submit = q<HTMLButtonElement>(view, 'button[type="submit"]');

  token.value = new URLSearchParams(location.search).get('token') ?? '';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.innerHTML = '';
    result.innerHTML = '';
    let problem: string | null = null;
    if (!token.value.trim()) problem = 'Token is required';
    else if (password.value.length < 8) problem = 'Password must be at least 8 characters';
    else if (password.value !== confirm.value) problem = 'Passwords do not match';
    if (problem) {
      errorBox.append(html(`<p role="alert" class="error">${esc(problem)}</p>`));
      return;
    }
    submit.disabled = true;
    const response = await api.password.reset(token.value.trim(), password.value);
    submit.disabled = false;
    if (response.status === 200) {
      result.append(html('<span>Password changed · <a href="/login">Back to sign in</a></span>'));
      form.reset();
      return;
    }
    const message = response.data && 'error' in response.data ? response.data.error : 'Could not change the password';
    errorBox.append(html(`<p role="alert" class="error">${esc(message)}</p>`));
  });

  (token.value ? password : token).focus();
};

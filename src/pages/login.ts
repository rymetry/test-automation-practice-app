import { api } from '../api';
import { refreshAuth } from '../auth';
import { html, q, setTitle } from '../dom';
import { navigate, type Page } from '../router';

export const loginPage: Page = (root) => {
  setTitle('Sign in');

  const view = html(`
    <section>
      <h1>Sign in</h1>
      <form data-testid="login-form" class="stack">
        <div class="field">
          <label for="username">Username</label>
          <input id="username" name="username" type="text" autocomplete="username" data-testid="username" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" data-testid="password" />
        </div>
        <div data-testid="login-error"></div>
        <div>
          <button type="submit" data-testid="sign-in">Sign in</button>
        </div>
      </form>
    </section>
  `);
  root.append(view);

  const form = q<HTMLFormElement>(view, 'form');
  const username = q<HTMLInputElement>(view, '#username');
  const password = q<HTMLInputElement>(view, '#password');
  const error = q(view, '[data-testid="login-error"]');
  const submit = q<HTMLButtonElement>(view, 'button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.innerHTML = '';
    submit.disabled = true;
    const result = await api.login(username.value, password.value);
    submit.disabled = false;
    if (result.status === 200) {
      await refreshAuth();
      navigate('/todos');
      return;
    }
    error.append(html('<p role="alert" class="error">Invalid username or password</p>'));
    password.value = '';
    password.focus();
  });

  username.focus();
};

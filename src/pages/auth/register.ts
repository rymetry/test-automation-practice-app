import { api } from '../../api';
import { refreshAuth } from '../../auth';
import { esc, html, q } from '../../dom';
import { navigate, type Page } from '../../router';
import { page } from '../../ui/page';

/** Creates an account that lives in this session only, then signs it in. */
export const registerPage: Page = (root) => {
  const view = page(
    'Register',
    'アカウントを作ってサインインします。作ったアカウントはあなたのセッションの中にだけ存在し、POST /api/reset で消えます。ユーザー名は a-z、0-9、_ の 3〜20 文字、パスワードは 8 文字以上です。',
    `
      <form class="stack card" data-testid="register-form" novalidate>
        <div class="field">
          <label for="register-full-name">Full name</label>
          <input id="register-full-name" name="fullName" type="text" autocomplete="name" />
        </div>
        <div class="field">
          <label for="register-email">Email</label>
          <input id="register-email" name="email" type="email" autocomplete="email" />
        </div>
        <div class="field">
          <label for="register-username">Username</label>
          <input id="register-username" name="username" type="text" autocomplete="username" />
        </div>
        <div class="field">
          <label for="register-password">Password</label>
          <input id="register-password" name="password" type="password" autocomplete="new-password" />
        </div>
        <div class="field">
          <label for="register-repeat">Repeat password</label>
          <input id="register-repeat" name="repeat" type="password" autocomplete="new-password" />
        </div>
        <div class="field field-inline">
          <input id="register-terms" name="terms" type="checkbox" />
          <label for="register-terms">Agree to Terms &amp; Conditions</label>
        </div>
        <div data-testid="register-error"></div>
        <div><button type="submit" data-testid="register">Register</button></div>
      </form>
      <p><a href="/login">Already have an account? Sign in</a></p>
    `,
  );
  root.append(view);

  const form = q<HTMLFormElement>(view, 'form');
  const errorBox = q(view, '[data-testid="register-error"]');
  const submit = q<HTMLButtonElement>(view, 'button[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.innerHTML = '';
    const value = (name: string): string => q<HTMLInputElement>(form, `[name="${name}"]`).value;
    const password = value('password');
    let problem: string | null = null;
    if (!value('fullName').trim()) problem = 'Full name is required';
    else if (!value('email').includes('@')) problem = 'Email must contain @';
    else if (!value('username').trim()) problem = 'Username is required';
    else if (password.length < 8) problem = 'Password must be at least 8 characters';
    else if (password !== value('repeat')) problem = 'Passwords do not match';
    else if (!q<HTMLInputElement>(form, '[name="terms"]').checked) problem = 'You must agree to the terms';
    if (problem) {
      errorBox.append(html(`<p role="alert" class="error">${esc(problem)}</p>`));
      return;
    }

    submit.disabled = true;
    const result = await api.register({
      fullName: value('fullName').trim(),
      email: value('email').trim(),
      username: value('username').trim(),
      password,
    });
    submit.disabled = false;
    if (result.status === 201) {
      await refreshAuth();
      navigate('/todos');
      return;
    }
    const message = result.data && 'error' in result.data ? result.data.error : 'Could not register';
    errorBox.append(html(`<p role="alert" class="error">${esc(message)}</p>`));
  });

  q<HTMLInputElement>(form, '#register-full-name').focus();
};

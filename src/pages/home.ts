import { html, setTitle } from '../dom';
import type { Page } from '../router';

export const homePage: Page = (root) => {
  setTitle('Home');
  root.append(
    html(`
      <section>
        <h1>Todo App</h1>
        <p>
          A small app built as a stable target for practising test automation.
          Everything you do here is kept in your own session and disappears after a day.
        </p>
        <p>Use the navigation above to open the todo list, sign in, or try the practice pages.</p>
      </section>
    `),
  );
};

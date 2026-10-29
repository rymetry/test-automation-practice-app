import { mountAuthStatus, refreshAuth } from './auth';
import { html, q } from './dom';
import { ambiguousPage } from './pages/ambiguous';
import { billingPage } from './pages/billing';
import { homePage } from './pages/home';
import { loginPage } from './pages/login';
import { notFoundPage } from './pages/not-found';
import { slowPage } from './pages/slow';
import { todosPage } from './pages/todos';
import { route, routeNotFound, start } from './router';

const app = q(document, '#app');
app.append(
  html(`
    <header class="site-header">
      <nav aria-label="Main">
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/todos">Todos</a></li>
          <li><a href="/settings/billing">Billing</a></li>
          <li><a href="/slow">Slow page</a></li>
          <li><a href="/ambiguous">Ambiguous page</a></li>
        </ul>
      </nav>
      <div class="auth" data-testid="auth-status"></div>
    </header>
  `),
  html('<main id="main" tabindex="-1"></main>'),
);

mountAuthStatus(q(app, '[data-testid="auth-status"]'));

route('/', homePage);
route('/todos', todosPage);
route('/login', loginPage);
route('/settings/billing', billingPage);
route('/slow', slowPage);
route('/ambiguous', ambiguousPage);
routeNotFound(notFoundPage);

void refreshAuth();
start(q(app, '#main'));

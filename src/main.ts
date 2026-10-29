import { mountAuthStatus, refreshAuth } from './auth';
import { q } from './dom';
import { mountShell } from './layout';
import { ambiguousPage } from './pages/ambiguous';
import { billingPage } from './pages/billing';
import { homePage } from './pages/home';
import { loginPage } from './pages/login';
import { notFoundPage } from './pages/not-found';
import { slowPage } from './pages/slow';
import { todosPage } from './pages/todos';
import { route, routeNotFound, start } from './router';
import { initTheme } from './theme';

initTheme();

const app = q(document, '#app');
const { main, authStatus } = mountShell(app);
mountAuthStatus(authStatus);

route('/', homePage);
route('/todos', todosPage);
route('/login', loginPage);
route('/settings/billing', billingPage);
route('/slow', slowPage);
route('/ambiguous', ambiguousPage);
routeNotFound(notFoundPage);

// 先にセッションを確立してからページを描画する。
// 同時に 2 つのリクエストが cookie 無しで飛ぶと別々のセッションが作られてしまうため。
await refreshAuth();
start(main);

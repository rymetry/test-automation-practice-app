import { mountAuthStatus, refreshAuth } from './auth';
import { q } from './dom';
import { mountShell } from './layout';
import { ambiguousPage } from './pages/ambiguous';
import { registerPage } from './pages/auth/register';
import { requestPasswordPage } from './pages/auth/request-password';
import { resetPasswordPage } from './pages/auth/reset-password';
import { billingPage } from './pages/billing';
import { boardPage } from './pages/board';
import { chartsPage } from './pages/charts';
import { filesPage } from './pages/files';
import { datepickerPage } from './pages/forms/datepicker';
import { formLayoutsPage } from './pages/forms/layouts';
import { homePage } from './pages/home';
import { loginPage } from './pages/login';
import { notFoundPage } from './pages/not-found';
import { dialogPage } from './pages/overlays/dialog';
import { popoverPage } from './pages/overlays/popover';
import { toastrPage } from './pages/overlays/toastr';
import { tooltipPage } from './pages/overlays/tooltip';
import { windowPage } from './pages/overlays/window';
import { slowPage } from './pages/slow';
import { smartTablePage } from './pages/tables/smart-table';
import { treeGridPage } from './pages/tables/tree-grid';
import { todosPage } from './pages/todos';
import { unnamedPage } from './pages/unnamed';
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
route('/forms/layouts', formLayoutsPage);
route('/forms/datepicker', datepickerPage);
route('/overlays/dialog', dialogPage);
route('/overlays/window', windowPage);
route('/overlays/popover', popoverPage);
route('/overlays/toastr', toastrPage);
route('/overlays/tooltip', tooltipPage);
route('/tables/smart-table', smartTablePage);
route('/tables/tree-grid', treeGridPage);
route('/board', boardPage);
route('/charts', chartsPage);
route('/auth/register', registerPage);
route('/auth/request-password', requestPasswordPage);
route('/auth/reset-password', resetPasswordPage);
route('/files', filesPage);
route('/unnamed', unnamedPage);
routeNotFound(notFoundPage);

// 先にセッションを確立してからページを描画する。
// 同時に 2 つのリクエストが cookie 無しで飛ぶと別々のセッションが作られてしまうため。
await refreshAuth();
start(main);

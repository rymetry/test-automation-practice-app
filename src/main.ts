import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import { mountAuthStatus, refreshAuth } from './auth';
import { q } from './dom';
import { mountShell } from './layout';
import { ambiguousPage } from './pages/AmbiguousPage';
import { registerPage } from './pages/auth/RegisterPage';
import { requestPasswordPage } from './pages/auth/RequestPasswordPage';
import { resetPasswordPage } from './pages/auth/ResetPasswordPage';
import { billingPage } from './pages/BillingPage';
import { boardPage } from './pages/board';
import { chartsPage } from './pages/charts';
import { inputsPage } from './pages/controls/InputsPage';
import { tabsPage } from './pages/controls/TabsPage';
import { mountEmbedForm } from './pages/EmbedFormPage';
import { filesPage } from './pages/FilesPage';
import { datepickerPage } from './pages/forms/DatepickerPage';
import { formLayoutsPage } from './pages/forms/LayoutsPage';
import { homePage } from './pages/HomePage';
import { loginPage } from './pages/LoginPage';
import { newTabPage } from './pages/NewTabPage';
import { notFoundPage } from './pages/NotFoundPage';
import { browserAlertsPage } from './pages/overlays/browser';
import { dialogPage } from './pages/overlays/dialog';
import { popoverPage } from './pages/overlays/popover';
import { toastrPage } from './pages/overlays/toastr';
import { tooltipPage } from './pages/overlays/tooltip';
import { windowPage } from './pages/overlays/window';
import { dynamicPage } from './pages/practice/DynamicPage';
import { framesPage } from './pages/practice/FramesPage';
import { slowPage } from './pages/SlowPage';
import { smartTablePage } from './pages/tables/smart-table';
import { treeGridPage } from './pages/tables/tree-grid';
import { todosPage } from './pages/TodosPage';
import { unnamedPage } from './pages/UnnamedPage';
import { route, routeNotFound, start } from './router';
import { initTheme } from './theme';

async function boot(): Promise<void> {
  initTheme();

  const app = q(document, '#app');
  if (location.pathname === '/embed/form') {
    // iframe 専用ルートはシェルや /api/me を使わず軽量に描画し、親側のフォーカスも奪わない。
    mountEmbedForm(app);
    return;
  }

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
  route('/controls/tabs', tabsPage);
  route('/controls/inputs', inputsPage);
  route('/overlays/dialog', dialogPage);
  route('/overlays/window', windowPage);
  route('/overlays/popover', popoverPage);
  route('/overlays/toastr', toastrPage);
  route('/overlays/tooltip', tooltipPage);
  route('/overlays/browser', browserAlertsPage);
  route('/new-tab', newTabPage);
  route('/tables/smart-table', smartTablePage);
  route('/tables/tree-grid', treeGridPage);
  route('/board', boardPage);
  route('/charts', chartsPage);
  route('/auth/register', registerPage);
  route('/auth/request-password', requestPasswordPage);
  route('/auth/reset-password', resetPasswordPage);
  route('/files', filesPage);
  route('/practice/frames', framesPage);
  route('/practice/dynamic', dynamicPage);
  route('/unnamed', unnamedPage);
  routeNotFound(notFoundPage);

  // 先にセッションを確立してからページを描画する。
  // 同時に 2 つのリクエストが cookie 無しで飛ぶと別々のセッションが作られてしまうため。
  await refreshAuth();
  start(main);
}

void boot();

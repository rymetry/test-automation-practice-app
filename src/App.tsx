import type { JSX } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { AuthProvider } from './auth';
import { AmbiguousPage } from './pages/AmbiguousPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { RequestPasswordPage } from './pages/auth/RequestPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { BillingPage } from './pages/BillingPage';
import { BoardPage } from './pages/BoardPage';
import { ChartsPage } from './pages/ChartsPage';
import { InputsPage } from './pages/controls/InputsPage';
import { TabsPage } from './pages/controls/TabsPage';
import { EmbedFormPage } from './pages/EmbedFormPage';
import { FilesPage } from './pages/FilesPage';
import { DatepickerPage } from './pages/forms/DatepickerPage';
import { LayoutsPage } from './pages/forms/LayoutsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NewTabPage } from './pages/NewTabPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { BrowserAlertsPage } from './pages/overlays/BrowserAlertsPage';
import { DialogPage } from './pages/overlays/DialogPage';
import { PopoverPage } from './pages/overlays/PopoverPage';
import { ToastrPage } from './pages/overlays/ToastrPage';
import { TooltipPage } from './pages/overlays/TooltipPage';
import { WindowPage } from './pages/overlays/WindowPage';
import { DynamicPage } from './pages/practice/DynamicPage';
import { FramesPage } from './pages/practice/FramesPage';
import { SlowPage } from './pages/SlowPage';
import { SmartTablePage } from './pages/tables/SmartTablePage';
import { TreeGridPage } from './pages/tables/TreeGridPage';
import { TodosPage } from './pages/TodosPage';
import { UnnamedPage } from './pages/UnnamedPage';
import { AppShell } from './shell/AppShell';

// 共通シェル内に描画するページ。パスは完全一致でのみ表示する。
const SHELL_PAGES: Array<[string, JSX.Element]> = [
  ['/', <HomePage />],
  ['/todos', <TodosPage />],
  ['/login', <LoginPage />],
  ['/settings/billing', <BillingPage />],
  ['/slow', <SlowPage />],
  ['/ambiguous', <AmbiguousPage />],
  ['/forms/layouts', <LayoutsPage />],
  ['/forms/datepicker', <DatepickerPage />],
  ['/controls/tabs', <TabsPage />],
  ['/controls/inputs', <InputsPage />],
  ['/overlays/dialog', <DialogPage />],
  ['/overlays/window', <WindowPage />],
  ['/overlays/popover', <PopoverPage />],
  ['/overlays/toastr', <ToastrPage />],
  ['/overlays/tooltip', <TooltipPage />],
  ['/overlays/browser', <BrowserAlertsPage />],
  ['/new-tab', <NewTabPage />],
  ['/tables/smart-table', <SmartTablePage />],
  ['/tables/tree-grid', <TreeGridPage />],
  ['/board', <BoardPage />],
  ['/charts', <ChartsPage />],
  ['/auth/register', <RegisterPage />],
  ['/auth/request-password', <RequestPasswordPage />],
  ['/auth/reset-password', <ResetPasswordPage />],
  ['/files', <FilesPage />],
  ['/practice/frames', <FramesPage />],
  ['/practice/dynamic', <DynamicPage />],
  ['/unnamed', <UnnamedPage />],
];

export function App(): JSX.Element {
  // React Router は大文字小文字違いや末尾スラッシュ付きのパスにも一致するため、完全一致するルートだけを登録し、
  // それ以外は README の契約どおりクライアント側の 404 にする。
  const { pathname } = useLocation();

  return (
    <Routes>
      {/* iframe 専用ルートはシェルや /api/me を使わず独立描画し、親側のフォーカスも奪わない。 */}
      {pathname === '/embed/form' ? <Route path="/embed/form" element={<EmbedFormPage />} /> : null}
      <Route
        element={
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        }
      >
        {SHELL_PAGES.filter(([path]) => path === pathname).map(([path, page]) => (
          <Route key={path} path={path} element={page} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

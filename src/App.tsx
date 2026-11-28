import type { JSX } from 'react';
import { Route, Routes } from 'react-router';
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

export function App(): JSX.Element {
  return (
    <Routes>
      {/* iframe 専用ルートはシェルや /api/me を使わず独立描画し、親側のフォーカスも奪わない。 */}
      <Route path="/embed/form" element={<EmbedFormPage />} />
      <Route
        element={
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/todos" element={<TodosPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/settings/billing" element={<BillingPage />} />
        <Route path="/slow" element={<SlowPage />} />
        <Route path="/ambiguous" element={<AmbiguousPage />} />
        <Route path="/forms/layouts" element={<LayoutsPage />} />
        <Route path="/forms/datepicker" element={<DatepickerPage />} />
        <Route path="/controls/tabs" element={<TabsPage />} />
        <Route path="/controls/inputs" element={<InputsPage />} />
        <Route path="/overlays/dialog" element={<DialogPage />} />
        <Route path="/overlays/window" element={<WindowPage />} />
        <Route path="/overlays/popover" element={<PopoverPage />} />
        <Route path="/overlays/toastr" element={<ToastrPage />} />
        <Route path="/overlays/tooltip" element={<TooltipPage />} />
        <Route path="/overlays/browser" element={<BrowserAlertsPage />} />
        <Route path="/new-tab" element={<NewTabPage />} />
        <Route path="/tables/smart-table" element={<SmartTablePage />} />
        <Route path="/tables/tree-grid" element={<TreeGridPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route path="/charts" element={<ChartsPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/request-password" element={<RequestPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/practice/frames" element={<FramesPage />} />
        <Route path="/practice/dynamic" element={<DynamicPage />} />
        <Route path="/unnamed" element={<UnnamedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

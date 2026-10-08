import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ROUTES } from './app/routes';
import { AdminLoginScreen } from './features/admin/components/AdminLoginScreen';
import { AdminLayout } from './features/admin/components/layout/AdminLayout';
import { AdminCustomerList } from './features/admin/components/customers/AdminCustomerList';
import { AdminCategoryList } from './features/admin/components/categories/AdminCategoryList';
import { AdminServiceList } from './features/admin/components/services/AdminServiceList';
import { AdminProviderApplicationList } from './features/admin/components/provider-applications/AdminProviderApplicationList';
import { AdminProviderApplicationDetail } from './features/admin/components/provider-applications/AdminProviderApplicationDetail';
import { AdminProviderList } from './features/admin/components/providers/AdminProviderList';
import { AdminAuthProvider } from './features/admin/hooks/AdminAuthProvider';
import { useAdminAuth } from './features/admin/hooks/useAdminAuth';
import { DialogProvider } from './components/ui/DialogProvider';
function DashboardPlaceholder() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-4">Tổng quan</h2>
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tổng khách hàng</p>
          <p className="text-3xl font-bold mt-2">1,204</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Doanh thu hôm nay</p>
          <p className="text-3xl font-bold mt-2">45,230 ₫</p>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const { isAuthenticated, isInitializing } = useAdminAuth();
  const isLoginPage = location.pathname === ROUTES.ADMIN.LOGIN;

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-slate-500">Đang kiểm tra phiên đăng nhập...</div>
      </div>
    );
  }

  if (isLoginPage) {
    if (isAuthenticated) {
      return <Navigate to={ROUTES.ADMIN.DASHBOARD} replace />;
    }
    return (
      <Routes>
        <Route path={ROUTES.ADMIN.LOGIN} element={<AdminLoginScreen />} />
      </Routes>
    );
  }

  if (!isAuthenticated && location.pathname.startsWith(ROUTES.ADMIN.DASHBOARD)) {
    return <Navigate to={ROUTES.ADMIN.LOGIN} state={{ from: location }} replace />;
  }

  return (
    <AdminLayout>
      <Routes>
        <Route path={ROUTES.ADMIN.DASHBOARD} element={<DashboardPlaceholder />} />
        <Route path={ROUTES.ADMIN.CUSTOMERS} element={<AdminCustomerList />} />
        <Route path={ROUTES.ADMIN.CATEGORIES} element={<AdminCategoryList />} />
        <Route path={ROUTES.ADMIN.SERVICES} element={<AdminServiceList />} />
        <Route path={ROUTES.ADMIN.PROVIDER_APPLICATIONS} element={<AdminProviderApplicationList />} />
        <Route path={`${ROUTES.ADMIN.PROVIDER_APPLICATIONS}/:id`} element={<AdminProviderApplicationDetail />} />
        <Route path={ROUTES.ADMIN.PROVIDERS} element={<AdminProviderList />} />
        <Route path="/admin/beauticians" element={<Navigate to={ROUTES.ADMIN.PROVIDERS} replace />} />
      </Routes>
    </AdminLayout>
  );
}

import { ProviderRegistrationApp } from './features/provider-registration';

function App() {
  return (
    <Router>
      <DialogProvider>
        <AdminAuthProvider>
          <Routes>
            {/* User/Provider Routes that don't need Admin Layout */}
            <Route path={ROUTES.PROVIDER.REGISTER} element={<ProviderRegistrationApp />} />
            
            {/* All other routes go through AppContent which has AdminLayout */}
            <Route path="*" element={<AppContent />} />
          </Routes>
        </AdminAuthProvider>
      </DialogProvider>
    </Router>
  );
}

export default App;

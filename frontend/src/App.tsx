import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { ROUTES } from './app/routes';
import { AdminLayout } from './features/admin/components/layout/AdminLayout';
import { AdminAuthProvider } from './features/admin/hooks/AdminAuthProvider';
import { useAdminAuth } from './features/admin/hooks/useAdminAuth';
import { DialogProvider } from './components/ui/DialogProvider';
import { LoaderCircle } from 'lucide-react';
import { canAccessFeature, type AdminFeature } from './features/admin/auth/admin-permissions';
import { ForbiddenPage } from './features/admin/components/system/ForbiddenPage';
import { NotFoundPage } from './features/admin/components/system/NotFoundPage';

const AdminLoginScreen = lazy(() =>
  import('./features/admin/components/AdminLoginScreen').then((m) => ({ default: m.AdminLoginScreen }))
);
const AdminCustomerList = lazy(() =>
  import('./features/admin/components/customers/AdminCustomerList').then((m) => ({ default: m.AdminCustomerList }))
);
const AdminCategoryList = lazy(() =>
  import('./features/admin/components/categories/AdminCategoryList').then((m) => ({ default: m.AdminCategoryList }))
);
const AdminServiceList = lazy(() =>
  import('./features/admin/components/services/AdminServiceList').then((m) => ({ default: m.AdminServiceList }))
);
const AdminProviderApplicationList = lazy(() =>
  import('./features/admin/components/provider-applications/AdminProviderApplicationList').then((m) => ({
    default: m.AdminProviderApplicationList,
  }))
);
const AdminProviderApplicationDetail = lazy(() =>
  import('./features/admin/components/provider-applications/AdminProviderApplicationDetail').then((m) => ({
    default: m.AdminProviderApplicationDetail,
  }))
);
const AdminProviderList = lazy(() =>
  import('./features/admin/components/providers/AdminProviderList').then((m) => ({ default: m.AdminProviderList }))
);
const AdminOrderOperations = lazy(() =>
  import('./features/admin/components/orders/AdminOrderOperations').then((m) => ({ default: m.AdminOrderOperations }))
);
const AdminProviderMembers = lazy(() =>
  import('./features/admin/components/provider-members/AdminProviderMembers').then((m) => ({ default: m.AdminProviderMembers }))
);
const AdminServiceChanges = lazy(() =>
  import('./features/admin/components/service-changes/AdminServiceChanges').then((m) => ({ default: m.AdminServiceChanges }))
);
const AdminFeedModeration = lazy(() =>
  import('./features/admin/components/feed/AdminFeedModeration').then((m) => ({ default: m.AdminFeedModeration }))
);
const AdminVouchers = lazy(() =>
  import('./features/admin/components/vouchers/AdminVouchers').then((m) => ({ default: m.AdminVouchers }))
);
const AdminInternalAdministration = lazy(() =>
  import('./features/admin/components/internal/AdminInternalAdministration').then((m) => ({ default: m.AdminInternalAdministration }))
);
const AdminDashboard = lazy(() =>
  import('./features/admin/components/dashboard/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AdminChangePasswordScreen = lazy(() =>
  import('./features/admin/components/auth/AdminChangePasswordScreen').then((m) => ({ default: m.AdminChangePasswordScreen }))
);
const AdminActivateScreen = lazy(() =>
  import('./features/admin/components/auth/AdminActivateScreen').then((m) => ({ default: m.AdminActivateScreen }))
);
const ProviderRegisterScreen = lazy(() =>
  import('./features/provider/components/ProviderRegisterScreen').then((m) => ({
    default: m.ProviderRegisterScreen,
  }))
);

function PageLoading() {
  return (
    <div className="flex h-64 w-full items-center justify-center text-slate-500">
      <LoaderCircle className="mr-2 h-6 w-6 animate-spin text-teal-700" />
      <span>Đang tải nội dung...</span>
    </div>
  );
}

function FeatureRoute({ feature, children }: { feature: AdminFeature | AdminFeature[]; children: React.ReactNode }) {
  const { account } = useAdminAuth();
  const features = Array.isArray(feature) ? feature : [feature];
  return features.some((item) => canAccessFeature(account?.roles, item)) ? children : <ForbiddenPage />;
}

function AppContent() {
  const location = useLocation();
  const { account, isAuthenticated, isInitializing } = useAdminAuth();
  const isLoginPage = location.pathname === ROUTES.ADMIN.LOGIN;
  const isActivationPage = location.pathname === ROUTES.ADMIN.ACTIVATE;

  if (isInitializing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex items-center text-slate-500">
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-teal-700" />
          <span>Đang kiểm tra phiên đăng nhập...</span>
        </div>
      </div>
    );
  }

  if (location.pathname === '/') {
    return <Navigate to={ROUTES.ADMIN.DASHBOARD} replace />;
  }

  if (location.pathname === ROUTES.PROVIDER.REGISTER) {
    return (
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route
            path={ROUTES.PROVIDER.REGISTER}
            element={<ProviderRegisterScreen />}
          />
        </Routes>
      </Suspense>
    );
  }

  if (isActivationPage) {
    return <Suspense fallback={<PageLoading />}><AdminActivateScreen /></Suspense>;
  }

  if (isLoginPage) {
    if (isAuthenticated) {
      return <Navigate to={account?.mustChangePassword ? ROUTES.ADMIN.CHANGE_PASSWORD : ROUTES.ADMIN.DASHBOARD} replace />;
    }
    return (
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path={ROUTES.ADMIN.LOGIN} element={<AdminLoginScreen />} />
        </Routes>
      </Suspense>
    );
  }

  if (!isAuthenticated && location.pathname.startsWith(ROUTES.ADMIN.DASHBOARD)) {
    return <Navigate to={ROUTES.ADMIN.LOGIN} state={{ from: location }} replace />;
  }

  if (account?.mustChangePassword && location.pathname !== ROUTES.ADMIN.CHANGE_PASSWORD) {
    return <Navigate to={ROUTES.ADMIN.CHANGE_PASSWORD} replace />;
  }

  return (
    <AdminLayout>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path={ROUTES.ADMIN.DASHBOARD} element={<AdminDashboard />} />
          <Route path={ROUTES.ADMIN.CHANGE_PASSWORD} element={<AdminChangePasswordScreen />} />
          <Route path={ROUTES.ADMIN.CUSTOMERS} element={<FeatureRoute feature="customers"><AdminCustomerList /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.CATEGORIES} element={<FeatureRoute feature="catalog"><AdminCategoryList /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.SERVICES} element={<FeatureRoute feature="catalog"><AdminServiceList /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.PROVIDER_APPLICATIONS} element={<FeatureRoute feature="providerApplications"><AdminProviderApplicationList /></FeatureRoute>} />
          <Route path={`${ROUTES.ADMIN.PROVIDER_APPLICATIONS}/:id`} element={<FeatureRoute feature="providerApplications"><AdminProviderApplicationDetail /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.PROVIDERS} element={<FeatureRoute feature="providers"><AdminProviderList /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.ORDERS} element={<FeatureRoute feature="orders"><AdminOrderOperations /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.PROVIDER_MEMBERS} element={<FeatureRoute feature={['memberOperations', 'memberKyc']}><AdminProviderMembers /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.SERVICE_CHANGES} element={<FeatureRoute feature="serviceChanges"><AdminServiceChanges /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.FEED_MODERATION} element={<FeatureRoute feature="feedModeration"><AdminFeedModeration /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.VOUCHERS} element={<FeatureRoute feature="vouchers"><AdminVouchers /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.INTERNAL_ACCOUNTS} element={<FeatureRoute feature="internalAdministration"><AdminInternalAdministration /></FeatureRoute>} />
          <Route path={ROUTES.ADMIN.AUDIT_LOGS} element={<FeatureRoute feature="internalAdministration"><AdminInternalAdministration initialTab="audit" /></FeatureRoute>} />
          <Route path="/admin/beauticians" element={<Navigate to={ROUTES.ADMIN.PROVIDERS} replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
}

function App() {
  return (
    <Router>
      <DialogProvider>
        <AdminAuthProvider>
          <Routes>
            <Route path="*" element={<AppContent />} />
          </Routes>
        </AdminAuthProvider>
      </DialogProvider>
    </Router>
  );
}

export default App;

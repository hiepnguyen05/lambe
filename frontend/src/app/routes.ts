export const ROUTES = {
  ADMIN: {
    LOGIN: '/admin/login',
    DASHBOARD: '/admin',
    CUSTOMERS: '/admin/customers',
    CATEGORIES: '/admin/categories',
    SERVICES: '/admin/services',
    PROVIDER_APPLICATIONS: '/admin/provider-applications',
    PROVIDER_APPLICATION_DETAIL: (id: string) => `/admin/provider-applications/${id}`,
    PROVIDERS: '/admin/providers',
  },
  PROVIDER: {
    REGISTER: '/provider/register',
  }
};

export function isAdminRoute(pathname: string): boolean {
  return pathname === ROUTES.ADMIN.DASHBOARD || pathname.startsWith(ROUTES.ADMIN.DASHBOARD + '/');
}

export const ROUTES = {
  ADMIN: {
    LOGIN: '/admin/login',
    ACTIVATE: '/admin/activate',
    CHANGE_PASSWORD: '/admin/change-password',
    DASHBOARD: '/admin',
    CUSTOMERS: '/admin/customers',
    CATEGORIES: '/admin/categories',
    SERVICES: '/admin/services',
    PROVIDER_APPLICATIONS: '/admin/provider-applications',
    PROVIDER_APPLICATION_DETAIL: (id: string) => `/admin/provider-applications/${id}`,
    PROVIDERS: '/admin/providers',
    ORDERS: '/admin/orders',
    PROVIDER_MEMBERS: '/admin/provider-members',
    SERVICE_CHANGES: '/admin/provider-service-change-requests',
    FEED_MODERATION: '/admin/feed-moderation',
    VOUCHERS: '/admin/vouchers',
    INTERNAL_ACCOUNTS: '/admin/internal-accounts',
    AUDIT_LOGS: '/admin/audit-logs',
  },
};

export function isAdminRoute(pathname: string): boolean {
  return pathname === ROUTES.ADMIN.DASHBOARD || pathname.startsWith(ROUTES.ADMIN.DASHBOARD + '/');
}

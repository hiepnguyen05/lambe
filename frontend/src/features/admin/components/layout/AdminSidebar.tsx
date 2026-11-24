import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../../../app/routes';
import {
  PanelLeftClose, PanelLeftOpen, LayoutDashboard,
  Users, Sparkles, Flower2,
  Settings, LogOut, Grid, FileCheck, ClipboardList, ListChecks, TicketPercent, ShieldCheck, UserCog
} from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePendingProviderApplicationCount } from '../../hooks/useProviderApplications';
import { canAccessFeature, type AdminFeature } from '../../auth/admin-permissions';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../../lib/api-client';

interface AdminSidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const navSections = [
  {
    title: "TỔNG QUAN",
    items: [
      { id: "dashboard", label: "Tổng quan / Dashboard", icon: LayoutDashboard, path: ROUTES.ADMIN.DASHBOARD, feature: 'dashboard' as AdminFeature },
    ]
  },
  {
    title: "VẬN HÀNH & KHÁCH HÀNG",
    items: [
      { id: "customers", label: "Quản lý khách hàng", icon: Users, path: ROUTES.ADMIN.CUSTOMERS, feature: 'customers' as AdminFeature },
      { id: "orders", label: "Vận hành đơn hàng", icon: ClipboardList, path: ROUTES.ADMIN.ORDERS, feature: 'orders' as AdminFeature },
      { id: "providers", label: "Chuyên viên & đối tác", icon: Sparkles, path: ROUTES.ADMIN.PROVIDERS, feature: 'providers' as AdminFeature },
      // { id: "provider-members", label: "Thành viên & KYC", icon: Users, path: ROUTES.ADMIN.PROVIDER_MEMBERS, feature: 'memberOperations' as AdminFeature },
      { id: "provider-applications", label: "Duyệt hồ sơ đối tác", icon: FileCheck, path: ROUTES.ADMIN.PROVIDER_APPLICATIONS, feature: 'providerApplications' as AdminFeature },
      { id: "service-changes", label: "Duyệt thay đổi dịch vụ", icon: ListChecks, path: ROUTES.ADMIN.SERVICE_CHANGES, feature: 'serviceChanges' as AdminFeature },
      { id: "feed-moderation", label: "Kiểm duyệt Beauty Feed", icon: ShieldCheck, path: ROUTES.ADMIN.FEED_MODERATION, feature: 'feedModeration' as AdminFeature },
    ]
  },
  {
    title: "DANH MỤC & TÀI CHÍNH",
    items: [
      { id: "categories", label: "Quản lý danh mục", icon: Grid, path: ROUTES.ADMIN.CATEGORIES, feature: 'catalog' as AdminFeature },
      { id: "services", label: "Dịch vụ & Bảng giá", icon: Flower2, path: ROUTES.ADMIN.SERVICES, feature: 'catalog' as AdminFeature },
      { id: "vouchers", label: "Voucher nền tảng", icon: TicketPercent, path: ROUTES.ADMIN.VOUCHERS, feature: 'vouchers' as AdminFeature },
    ]
  },
  {
    title: "HỆ THỐNG",
    items: [
      { id: "internal-accounts", label: "Tài khoản & Audit", icon: UserCog, path: ROUTES.ADMIN.INTERNAL_ACCOUNTS, feature: 'internalAdministration' as AdminFeature },
    ]
  }
];

export function AdminSidebar({ sidebarCollapsed, setSidebarCollapsed }: AdminSidebarProps) {
  const location = useLocation();
  const { account, logout } = useAdminAuth();
  const pendingProviderApplications = usePendingProviderApplicationCount();
  const canReadOrderAlerts = canAccessFeature(account?.roles, 'orderAlerts');
  const orderAlerts = useQuery({
    queryKey: ['admin-sidebar-order-alerts'],
    queryFn: () => apiRequest<{ data: unknown[] }>('/admin/orders/operational-alerts'),
    enabled: canReadOrderAlerts,
    refetchInterval: 30_000,
    staleTime: 30_000,
  });
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.id === 'provider-members'
        ? canAccessFeature(account?.roles, 'memberOperations') || canAccessFeature(account?.roles, 'memberKyc')
        : canAccessFeature(account?.roles, item.feature)),
    }))
    .filter((section) => section.items.length > 0);

  const displayName = account?.fullName || account?.username || "Quản trị viên";
  const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : 'A';

  return (
    <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} flex-shrink-0 bg-white border-r border-slate-200/90 flex flex-col justify-between transition-[width] duration-300 z-40 sticky top-0 h-screen shadow-sm will-change-[width]`}>
      {/* Top Brand Header */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="h-20 px-5 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <img
              src="/lambe-logo.svg"
              alt="Lambe Logo"
              className="w-10 h-10 rounded-xl object-contain shadow-sm flex-shrink-0"
            />
            {!sidebarCollapsed && (
              <div className="leading-tight truncate">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-[#0f766e] tracking-tight text-xl font-sans">Lambe</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-50 text-[#0f766e] border border-teal-200/60">
                    PORTAL
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">Enterprise Admin Console</p>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition hidden lg:flex items-center justify-center"
            title={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Menu Categories */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== ROUTES.ADMIN.DASHBOARD && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                const badge = item.id === 'provider-applications' && pendingProviderApplications > 0
                  ? `${pendingProviderApplications} mới`
                  : item.id === 'orders' && canReadOrderAlerts && (orderAlerts.data?.data.length ?? 0) > 0
                    ? `${orderAlerts.data!.data.length} cảnh báo`
                    : undefined;
                const badgeAlert = item.id === 'provider-applications' || item.id === 'orders';
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 group relative ${
                      isActive
                        ? "bg-[#0f766e] text-white font-semibold shadow-sm shadow-[#0f766e]/25"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                    }`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!sidebarCollapsed && badge && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#0d5f58] text-teal-100'
                          : badgeAlert
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        {badge}
                      </span>
                    )}

                    {/* Active Indicator bar */}
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[#2dd4bf]"></span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Profile Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70 flex-shrink-0">
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} p-1.5 rounded-xl hover:bg-white transition shadow-2xs`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-teal-100 text-[#0f766e] flex items-center justify-center font-bold text-sm ring-2 ring-[#0f766e]/25 shadow-inner">
                {getInitials(displayName)}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
            </div>
            {!sidebarCollapsed && (
              <div className="truncate text-left">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {displayName}
                </div>
                <div className="text-[10px] text-[#0f766e] font-semibold truncate uppercase">
                  {account?.roles?.join(', ') || 'Chưa cấp quyền'}
                </div>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <div className="flex items-center">
              <Link to={ROUTES.ADMIN.CHANGE_PASSWORD} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer" title="Đổi mật khẩu">
                <Settings className="w-3.5 h-3.5" />
              </Link>
              <button 
                onClick={logout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" 
                title="Đăng xuất"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

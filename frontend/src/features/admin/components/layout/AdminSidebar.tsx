import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../../../app/routes';
import {
  PanelLeftClose, PanelLeftOpen, LayoutDashboard, BarChart3,
  Users, Sparkles, CalendarClock, MessageSquareHeart,
  Flower2, WalletCards, Sliders, ShieldCheck,
  Settings, LogOut, Grid, FileCheck
} from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { usePendingProviderApplicationCount } from '../../hooks/useProviderApplications';

interface AdminSidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const navSections = [
  {
    title: "TỔNG QUAN",
    items: [
      { id: "dashboard", label: "Tổng quan / Dashboard", icon: LayoutDashboard, path: ROUTES.ADMIN.DASHBOARD },
      { id: "analytics", label: "Báo cáo & Phân tích", icon: BarChart3, path: "/admin/analytics" }, // Placeholder
    ]
  },
  {
    title: "VẬN HÀNH & KHÁCH HÀNG",
    items: [
      { id: "customers", label: "Quản lý khách hàng", icon: Users, path: ROUTES.ADMIN.CUSTOMERS, badge: "8.420" },
      { id: "providers", label: "Chuyên viên & đối tác", icon: Sparkles, path: ROUTES.ADMIN.PROVIDERS },
      { id: "provider-applications", label: "Duyệt hồ sơ đối tác", icon: FileCheck, path: ROUTES.ADMIN.PROVIDER_APPLICATIONS },
      { id: "bookings", label: "Lịch hẹn & Đơn", icon: CalendarClock, path: "/admin/bookings", badge: "8 mới", badgeAlert: true }, // Placeholder
      { id: "reviews", label: "Đánh giá & CSKH", icon: MessageSquareHeart, path: "/admin/reviews" }, // Placeholder
    ]
  },
  {
    title: "DANH MỤC & TÀI CHÍNH",
    items: [
      { id: "categories", label: "Quản lý danh mục", icon: Grid, path: ROUTES.ADMIN.CATEGORIES },
      { id: "services", label: "Dịch vụ & Bảng giá", icon: Flower2, path: ROUTES.ADMIN.SERVICES },
      { id: "finance", label: "Doanh thu & Đối soát", icon: WalletCards, path: "/admin/finance" }, // Placeholder
    ]
  },
  {
    title: "HỆ THỐNG",
    items: [
      { id: "settings", label: "Cài đặt hệ thống", icon: Sliders, path: "/admin/settings" }, // Placeholder
      { id: "roles", label: "Phân quyền & Nhật ký", icon: ShieldCheck, path: "/admin/roles" }, // Placeholder
    ]
  }
];

export function AdminSidebar({ sidebarCollapsed, setSidebarCollapsed }: AdminSidebarProps) {
  const location = useLocation();
  const { account, logout } = useAdminAuth();
  const pendingProviderApplications = usePendingProviderApplicationCount();

  const displayName = account?.fullName || account?.username || "Quản trị viên";
  const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : 'A';

  return (
    <aside className={`${sidebarCollapsed ? 'w-20' : 'w-72'} flex-shrink-0 bg-white border-r border-slate-200/90 flex flex-col justify-between transition-all duration-300 z-40 sticky top-0 h-screen shadow-sm`}>
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
          {navSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-3 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== ROUTES.ADMIN.DASHBOARD && location.pathname.startsWith(item.path));
                const Icon = item.icon;
                const badge = item.id === 'provider-applications'
                  ? pendingProviderApplications > 0
                    ? `${pendingProviderApplications} mới`
                    : undefined
                  : item.badge;
                const badgeAlert = item.id === 'provider-applications' || item.badgeAlert;
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
              <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer" title="Cài đặt tài khoản">
                <Settings className="w-3.5 h-3.5" />
              </button>
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

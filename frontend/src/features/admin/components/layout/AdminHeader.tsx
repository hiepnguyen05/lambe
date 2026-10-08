import { ChevronRight, Search, MapPin, HelpCircle, Bell, Download, UserPlus } from 'lucide-react';
import { useState } from 'react';

export function AdminHeader() {
  const [cityBranch, setCityBranch] = useState("hcm");

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-6 sm:px-8 py-3.5 flex items-center justify-between">
      {/* Left: Breadcrumbs + Global Search */}
      <div className="flex items-center gap-6">
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span className="hover:text-slate-800 cursor-pointer">Trang chủ</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="hover:text-slate-800 cursor-pointer">Quản lý vận hành</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[#0f766e] font-semibold bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
            Quản lý khách hàng
          </span>
        </nav>

        {/* Global Search box with Ctrl+K */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-400 w-64 hover:border-slate-300 transition cursor-pointer">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-500 flex-1 truncate">Tìm kiếm nhanh...</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs">⌘K</kbd>
        </div>
      </div>

      {/* Right: Branch Selector, Health status, Actions */}
      <div className="flex items-center gap-3">
        {/* Branch Switcher */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
          <MapPin className="w-3.5 h-3.5 text-[#0f766e]" />
          <select 
            value={cityBranch} 
            onChange={(e) => setCityBranch(e.target.value)}
            className="bg-transparent border-none p-0 text-xs font-semibold text-slate-700 focus:ring-0 cursor-pointer outline-none"
          >
            <option value="hcm">Khu vực TP. Hồ Chí Minh</option>
            <option value="hn">Khu vực TP. Hà Nội</option>
            <option value="dn">Khu vực TP. Đà Nẵng</option>
          </select>
        </div>

        {/* System Realtime status */}
        <div className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-50/80 text-emerald-800 border border-emerald-200/70">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Sẵn sàng 99.98%</span>
        </div>

        <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

        {/* Help button */}
        <button className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition hidden sm:flex" title="Tài liệu & Hướng dẫn">
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Notification bell */}
        <button className="relative p-2 rounded-xl text-slate-500 hover:text-[#0f766e] hover:bg-teal-50 transition" title="Thông báo hệ thống">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
        </button>

        {/* Export button */}
        <button className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-2xs">
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Xuất file CSV</span>
        </button>

        {/* Add new Customer */}
        <button className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#0f766e] hover:bg-[#0d5f58] rounded-xl shadow-sm shadow-[#0f766e]/25 transition active:scale-95">
          <UserPlus className="w-3.5 h-3.5" />
          <span>Thêm khách hàng</span>
        </button>
      </div>
    </header>
  );
}

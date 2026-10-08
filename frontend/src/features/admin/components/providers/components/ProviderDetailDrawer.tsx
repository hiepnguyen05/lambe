import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  ExternalLink,
  LoaderCircle,
  MapPin,
  PauseCircle,
  Phone,
  PlayCircle,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import type { AdminProviderDetail } from '../../../hooks/useAdminProviders';
import { ProviderStatusBadge } from './ProviderStatusBadge';

interface ProviderDetailDrawerProps {
  provider: AdminProviderDetail | null;
  isLoading: boolean;
  error: string;
  canManage: boolean;
  actionLoading: boolean;
  onClose: () => void;
  onStatusChange: (provider: AdminProviderDetail) => void;
}

export function ProviderDetailDrawer({
  provider,
  isLoading,
  error,
  canManage,
  actionLoading,
  onClose,
  onStatusChange,
}: ProviderDetailDrawerProps) {
  const [tab, setTab] = useState<'OVERVIEW' | 'OPERATIONS'>('OVERVIEW');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45" role="presentation">
      <button type="button" aria-label="Đóng hồ sơ" className="absolute inset-0" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Chi tiết chuyên viên hoặc đối tác"
        className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
      >
        <header className="flex min-h-16 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="font-bold text-slate-900">Hồ sơ vận hành</h2>
            <p className="text-xs text-slate-500">Thông tin sau khi hồ sơ đăng ký được phê duyệt</p>
          </div>
          <button
            type="button"
            title="Đóng"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
            <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-teal-700" />
            Đang tải hồ sơ
          </div>
        ) : error || !provider ? (
          <div className="flex flex-1 items-center justify-center px-8 text-center text-sm text-rose-700">
            {error || 'Không thể hiển thị hồ sơ.'}
          </div>
        ) : (
          <>
            <div className="border-b border-slate-200 px-5 py-5">
              <div className="flex items-start gap-4">
                {provider.avatarUrl ? (
                  <img
                    src={provider.avatarUrl}
                    alt={provider.displayName}
                    className="h-20 w-20 rounded-full border-2 border-white object-cover shadow ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-500 ring-1 ring-slate-200">
                    {provider.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-xl font-bold text-slate-950">{provider.displayName}</h3>
                    <ProviderStatusBadge status={provider.status} />
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    {provider.providerType === 'INDIVIDUAL' ? (
                      <UserRound className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                    {provider.providerType === 'INDIVIDUAL' ? 'Chuyên viên cá nhân' : 'Đối tác tổ chức'}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                    <Phone className="h-4 w-4" /> {provider.user.phone}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex border-b border-slate-200 px-5">
              <TabButton active={tab === 'OVERVIEW'} onClick={() => setTab('OVERVIEW')}>
                Tổng quan
              </TabButton>
              <TabButton active={tab === 'OPERATIONS'} onClick={() => setTab('OPERATIONS')}>
                Dịch vụ & lịch làm việc
              </TabButton>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {tab === 'OVERVIEW' ? <Overview provider={provider} /> : <Operations provider={provider} />}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <Link
                to={`/admin/provider-applications/${provider.sourceApplicationId}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-800 hover:underline"
              >
                Hồ sơ đăng ký gốc <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              {canManage && provider.status !== 'SETUP_REQUIRED' && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => onStatusChange(provider)}
                  className={`inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-50 ${
                    provider.status === 'SUSPENDED'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  {actionLoading ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : provider.status === 'SUSPENDED' ? (
                    <PlayCircle className="h-4 w-4" />
                  ) : (
                    <PauseCircle className="h-4 w-4" />
                  )}
                  {provider.status === 'SUSPENDED' ? 'Khôi phục' : 'Đình chỉ'}
                </button>
              )}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

function Overview({ provider }: { provider: AdminProviderDetail }) {
  return (
    <div className="space-y-6">
      <section>
        <h4 className="text-xs font-bold uppercase text-slate-500">Thông tin chuyên môn</h4>
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
          <Detail label="Kinh nghiệm" value={provider.experienceYears === null ? 'Chưa cập nhật' : `${provider.experienceYears} năm`} />
          <Detail label="Ngày được duyệt" value={formatDate(provider.createdAt)} />
          <Detail label="Thiết lập vận hành" value={provider.setupCompletedAt ? formatDate(provider.setupCompletedAt) : 'Chưa hoàn thành'} />
          <Detail label="Trạng thái tài khoản" value={userStatusLabel(provider.user.status)} />
        </dl>
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-700">
          {provider.biography || 'Chưa có phần giới thiệu chuyên môn.'}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
          <MapPin className="h-4 w-4" /> Khu vực phục vụ
        </h4>
        <p className="mt-3 font-semibold text-slate-900">{provider.serviceAreaName || 'Chưa thiết lập'}</p>
        <p className="mt-1 text-sm text-slate-500">
          {provider.serviceRadiusKm ? `Bán kính phục vụ ${provider.serviceRadiusKm} km` : 'Chưa thiết lập bán kính phục vụ'}
        </p>
      </section>

      <section className="border-t border-slate-200 pt-5">
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
          <WalletCards className="h-4 w-4" /> Ví đối tác
        </h4>
        <div className="mt-3 grid grid-cols-2 gap-5">
          <Detail label="Số dư khả dụng" value={formatMoney(provider.wallet?.balanceAmount ?? 0)} />
          <Detail label="Đang tạm giữ" value={formatMoney(provider.wallet?.heldAmount ?? 0)} />
        </div>
      </section>
    </div>
  );
}

function Operations({ provider }: { provider: AdminProviderDetail }) {
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase text-slate-500">Dịch vụ được cấp phép</h4>
          <span className="text-xs font-semibold text-slate-500">{provider.services.length} dịch vụ</span>
        </div>
        <div className="mt-3 divide-y divide-slate-100 border-y border-slate-200">
          {provider.services.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Chưa có dịch vụ.</p>
          ) : (
            provider.services.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 py-3.5">
                <div>
                  <p className="font-semibold text-slate-900">{item.service.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.service.category.name} · {item.service.code}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{formatMoney(item.priceAmount)}</p>
                  <p className={`mt-0.5 text-xs font-semibold ${serviceStatusColor(item.status)}`}>
                    {serviceStatusLabel(item.status)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
          <CalendarDays className="h-4 w-4" /> Lịch làm việc
        </h4>
        <div className="mt-3 divide-y divide-slate-100 border-y border-slate-200">
          {provider.workingHours.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Chưa thiết lập lịch làm việc.</p>
          ) : (
            provider.workingHours.map((slot, index) => (
              <div key={`${slot.dayOfWeek}-${slot.startMinute}-${index}`} className="flex justify-between py-3 text-sm">
                <span className="font-medium text-slate-700">{dayLabel(slot.dayOfWeek)}</span>
                <span className="font-semibold text-slate-900">
                  {minuteLabel(slot.startMinute)} - {minuteLabel(slot.endMinute)}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-3 text-sm font-semibold ${
        active ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {children}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
}

function minuteLabel(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function dayLabel(value: number) {
  return ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'][value] || `Ngày ${value}`;
}

function userStatusLabel(value: AdminProviderDetail['user']['status']) {
  return { ACTIVE: 'Đang hoạt động', INACTIVE: 'Tạm vô hiệu', BLOCKED: 'Bị khóa' }[value];
}

function serviceStatusLabel(value: AdminProviderDetail['services'][number]['status']) {
  return { ACTIVE: 'Đang bật', INACTIVE: 'Đang tắt', SUSPENDED: 'Bị đình chỉ' }[value];
}

function serviceStatusColor(value: AdminProviderDetail['services'][number]['status']) {
  return { ACTIVE: 'text-emerald-700', INACTIVE: 'text-slate-500', SUSPENDED: 'text-rose-700' }[value];
}

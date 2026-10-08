import {
  Building2,
  Eye,
  LoaderCircle,
  MapPin,
  PauseCircle,
  PlayCircle,
  UserRound,
} from 'lucide-react';
import type { AdminProvider } from '../../../hooks/useAdminProviders';
import { ProviderStatusBadge } from './ProviderStatusBadge';

interface ProviderTableProps {
  providers: AdminProvider[];
  isLoading: boolean;
  activeAction: string | null;
  canManage: boolean;
  onView: (provider: AdminProvider) => void;
  onStatusChange: (provider: AdminProvider) => void;
}

export function ProviderTable({
  providers,
  isLoading,
  activeAction,
  canManage,
  onView,
  onStatusChange,
}: ProviderTableProps) {
  const rows = Array.isArray(providers) ? providers : [];

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="min-h-[430px] overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-500">
              <th className="px-4 py-3.5">Chuyên viên / đối tác</th>
              <th className="px-4 py-3.5">Phân loại</th>
              <th className="px-4 py-3.5">Khu vực phục vụ</th>
              <th className="px-4 py-3.5">Dịch vụ</th>
              <th className="px-4 py-3.5">Trạng thái</th>
              <th className="px-4 py-3.5 text-right">Tác vụ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="h-72 text-center text-slate-500">
                  <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-teal-700" />
                  Đang tải dữ liệu
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-72 text-center text-slate-500">
                  Không có hồ sơ phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              rows.map((provider) => {
                const isActionLoading = activeAction?.endsWith(provider.id) ?? false;
                return (
                  <tr key={provider.id} className="transition hover:bg-slate-50/80">
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => onView(provider)}
                        className="flex items-center gap-3 text-left"
                      >
                        <ProviderAvatar provider={provider} />
                        <span className="min-w-0">
                          <span className="block max-w-56 truncate font-bold text-slate-900">
                            {provider.displayName}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {provider.user.phone}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                        {provider.providerType === 'INDIVIDUAL' ? (
                          <UserRound className="h-4 w-4 text-teal-700" />
                        ) : (
                          <Building2 className="h-4 w-4 text-sky-700" />
                        )}
                        {provider.providerType === 'INDIVIDUAL' ? 'Chuyên viên' : 'Đối tác'}
                      </span>
                      {provider.experienceYears !== null && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {provider.experienceYears} năm kinh nghiệm
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex max-w-52 items-start gap-1.5 text-slate-700">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span>
                          {provider.serviceAreaName || 'Chưa thiết lập'}
                          {provider.serviceRadiusKm && (
                            <span className="block text-xs text-slate-500">
                              Bán kính {provider.serviceRadiusKm} km
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold text-slate-900">{provider.serviceCounts.active}</span>
                      <span className="text-slate-500">/{provider.serviceCounts.total} đang bật</span>
                      {provider.serviceCounts.suspended > 0 && (
                        <span className="mt-1 block text-xs font-medium text-rose-600">
                          {provider.serviceCounts.suspended} dịch vụ bị đình chỉ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <ProviderStatusBadge status={provider.status} />
                      {provider.isOnline && provider.status === 'ACTIVE' && (
                        <span className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Đang trực tuyến
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1">
                        {canManage && provider.status !== 'SETUP_REQUIRED' && (
                          <button
                            type="button"
                            title={provider.status === 'SUSPENDED' ? 'Khôi phục hoạt động' : 'Đình chỉ hoạt động'}
                            disabled={isActionLoading}
                            onClick={() => onStatusChange(provider)}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-md disabled:opacity-40 ${
                              provider.status === 'SUSPENDED'
                                ? 'text-emerald-700 hover:bg-emerald-50'
                                : 'text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            {isActionLoading ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : provider.status === 'SUSPENDED' ? (
                              <PlayCircle className="h-4 w-4" />
                            ) : (
                              <PauseCircle className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          title="Xem hồ sơ"
                          onClick={() => onView(provider)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-teal-800"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProviderAvatar({ provider }: { provider: AdminProvider }) {
  if (provider.avatarUrl) {
    return (
      <img
        src={provider.avatarUrl}
        alt={provider.displayName}
        className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 font-bold text-teal-800 ring-1 ring-teal-100">
      {provider.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

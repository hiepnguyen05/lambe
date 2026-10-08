import { useState } from 'react';
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  CirclePause,
  Clock3,
  RefreshCw,
  Search,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useDialog } from '../../../../components/ui/DialogProvider';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import {
  type AdminProvider,
  type AdminProviderDetail,
  useAdminProviders,
} from '../../hooks/useAdminProviders';
import { ProviderDetailDrawer } from './components/ProviderDetailDrawer';
import { ProviderTable } from './components/ProviderTable';

export function AdminProviderList() {
  const { account } = useAdminAuth();
  const { showDialog } = useDialog();
  const {
    providers,
    summary,
    searchQuery,
    changeSearch,
    providerType,
    selectProviderType,
    status,
    selectStatus,
    pagination,
    setPagination,
    isLoading,
    activeAction,
    error,
    refetch,
    fetchProviderDetail,
    updateProviderStatus,
  } = useAdminProviders();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminProviderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const canManage = (account?.roles ?? []).some((role) => ['ADMIN', 'MODERATOR'].includes(role));

  const openDetail = async (provider: AdminProvider) => {
    setSelectedId(provider.id);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      setDetail(await fetchProviderDetail(provider.id));
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : 'Không thể tải hồ sơ.');
    } finally {
      setDetailLoading(false);
    }
  };

  const confirmStatusChange = (provider: AdminProvider | AdminProviderDetail) => {
    const restore = provider.status === 'SUSPENDED';
    showDialog({
      title: restore ? 'Khôi phục hoạt động' : 'Đình chỉ hoạt động',
      message: restore
        ? `Khôi phục quyền hoạt động cho ${provider.displayName}. Vui lòng ghi lý do:`
        : `Sau khi đình chỉ, ${provider.displayName} sẽ ngừng nhận đơn và bị đưa khỏi kết quả tìm kiếm. Vui lòng ghi lý do:`,
      type: restore ? 'success' : 'warning',
      withInput: true,
      inputPlaceholder: 'Nhập lý do xử lý...',
      inputDefaultValue: '',
      inputSuggestions: restore
        ? ['Đã hoàn tất xác minh và đủ điều kiện hoạt động', 'Đã xử lý xong phản ánh của khách hàng']
        : ['Tạm dừng để xác minh phản ánh từ khách hàng', 'Vi phạm tiêu chuẩn chất lượng dịch vụ'],
      confirmText: restore ? 'Khôi phục' : 'Đình chỉ',
      onConfirm: async (reason) => {
        if (!reason || reason.trim().length < 10) {
          showDialog({ title: 'Lý do chưa hợp lệ', message: 'Lý do phải có ít nhất 10 ký tự.', type: 'error' });
          return;
        }
        try {
          const updated = await updateProviderStatus(
            provider.id,
            restore ? 'ACTIVE' : 'SUSPENDED',
            reason.trim(),
          );
          if (selectedId === provider.id) setDetail(updated);
          showDialog({
            title: 'Đã cập nhật',
            message: restore ? 'Nhà cung cấp đã được khôi phục hoạt động.' : 'Nhà cung cấp đã bị đình chỉ hoạt động.',
            type: 'success',
          });
        } catch (requestError) {
          showDialog({
            title: 'Không thể cập nhật',
            message: requestError instanceof Error ? requestError.message : 'Có lỗi xảy ra khi cập nhật trạng thái.',
            type: 'error',
          });
        }
      },
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-950">Chuyên viên & đối tác</h1>
          <p className="mt-1 text-sm text-slate-500">Quản lý hồ sơ đã được duyệt, phạm vi phục vụ và trạng thái vận hành.</p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isLoading}
          className="inline-flex h-9 items-center gap-2 self-start rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </header>

      <nav className="flex overflow-x-auto border-b border-slate-200" aria-label="Phân loại nhà cung cấp">
        <TypeTab active={providerType === 'ALL'} icon={<UsersRound className="h-4 w-4" />} label="Tất cả" count={summary.total} onClick={() => selectProviderType('ALL')} />
        <TypeTab active={providerType === 'INDIVIDUAL'} icon={<UserRound className="h-4 w-4" />} label="Chuyên viên" count={summary.individuals} onClick={() => selectProviderType('INDIVIDUAL')} />
        <TypeTab active={providerType === 'ORGANIZATION'} icon={<Building2 className="h-4 w-4" />} label="Đối tác" count={summary.organizations} onClick={() => selectProviderType('ORGANIZATION')} />
      </nav>

      <section className="grid divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Metric icon={<BadgeCheck className="h-5 w-5 text-emerald-700" />} label="Đang hoạt động" value={summary.active} />
        <Metric icon={<Clock3 className="h-5 w-5 text-amber-700" />} label="Chờ thiết lập" value={summary.setupRequired} />
        <Metric icon={<CirclePause className="h-5 w-5 text-rose-700" />} label="Đã đình chỉ" value={summary.suspended} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(event) => changeSearch(event.target.value)}
            placeholder="Tìm theo tên, số điện thoại, khu vực hoặc mã hồ sơ"
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
          />
        </label>
        <select
          value={status}
          onChange={(event) => selectStatus(event.target.value as typeof status)}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 focus:border-teal-700 focus:ring-teal-700"
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="SETUP_REQUIRED">Chờ thiết lập</option>
          <option value="SUSPENDED">Đã đình chỉ</option>
        </select>
        <select
          value={pagination.limit}
          onChange={(event) => setPagination((current) => ({ ...current, page: 1, limit: Number(event.target.value) }))}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-teal-700 focus:ring-teal-700"
          aria-label="Số dòng mỗi trang"
        >
          <option value={10}>10 dòng</option>
          <option value={20}>20 dòng</option>
          <option value={50}>50 dòng</option>
        </select>
      </section>

      {error && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}

      <ProviderTable
        providers={providers}
        isLoading={isLoading}
        activeAction={activeAction}
        canManage={canManage}
        onView={(provider) => void openDetail(provider)}
        onStatusChange={confirmStatusChange}
      />

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Trang {pagination.page}/{pagination.totalPages}</span>
        <div className="flex gap-1">
          <button
            type="button"
            title="Trang trước"
            disabled={pagination.page <= 1 || isLoading}
            onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Trang sau"
            disabled={pagination.page >= pagination.totalPages || isLoading}
            onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {selectedId && (
        <ProviderDetailDrawer
          provider={detail}
          isLoading={detailLoading}
          error={detailError}
          canManage={canManage}
          actionLoading={Boolean(activeAction)}
          onClose={() => {
            setSelectedId(null);
            setDetail(null);
          }}
          onStatusChange={confirmStatusChange}
        />
      )}
    </div>
  );
}

function TypeTab({ active, icon, label, count, onClick }: { active: boolean; icon: React.ReactNode; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
        active ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'
      }`}
    >
      {icon} {label}
      <span className={`rounded-md px-1.5 py-0.5 text-xs ${active ? 'bg-teal-50 text-teal-800' : 'bg-slate-100'}`}>{count}</span>
    </button>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-50">{icon}</span>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-slate-950">{value}</p>
      </div>
    </div>
  );
}

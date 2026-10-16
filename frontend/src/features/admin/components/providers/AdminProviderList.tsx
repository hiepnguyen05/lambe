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

const activityReasonSuggestions = {
  restore: [
    {
      label: 'Đã hoàn tất xác minh',
      value:
        'Đã hoàn tất xác minh phản ánh; hồ sơ đủ điều kiện tiếp tục hoạt động trên nền tảng.',
      description: 'Dùng khi kết quả kiểm tra không còn vấn đề cần hạn chế hoạt động.',
    },
    {
      label: 'Đã bổ sung giấy tờ',
      value:
        'Đã kiểm tra giấy tờ bổ sung còn hiệu lực và khôi phục quyền hoạt động của nhà cung cấp.',
      description: 'Dùng sau khi đối tác cập nhật đầy đủ giấy phép hoặc chứng chỉ.',
    },
    {
      label: 'Đã khắc phục chất lượng',
      value:
        'Nhà cung cấp đã hoàn thành yêu cầu khắc phục chất lượng và cam kết tuân thủ quy trình vận hành.',
      description: 'Dùng khi các yêu cầu cải thiện đã được kiểm tra và xác nhận.',
    },
  ],
  suspend: [
    {
      label: 'Xác minh phản ánh',
      value:
        'Tạm đình chỉ hoạt động để xác minh phản ánh về chất lượng dịch vụ từ khách hàng.',
      description: 'Dùng khi vụ việc đang được bộ phận vận hành làm rõ.',
    },
    {
      label: 'Không đạt chất lượng',
      value:
        'Đình chỉ do nhiều lần không đáp ứng tiêu chuẩn chất lượng và quy trình phục vụ của Lambe.',
      description: 'Nên bổ sung số lần vi phạm hoặc mã vụ việc vào nội dung bên dưới.',
    },
    {
      label: 'Giấy tờ hết hiệu lực',
      value:
        'Tạm đình chỉ do giấy tờ chuyên môn hoặc giấy phép hoạt động đã hết hiệu lực và cần cập nhật.',
      description: 'Dùng khi điều kiện pháp lý hoặc chuyên môn chưa còn hiệu lực.',
    },
    {
      label: 'Rủi ro an toàn',
      value:
        'Đình chỉ khẩn cấp để kiểm tra dấu hiệu vi phạm an toàn, vệ sinh hoặc hành vi không phù hợp.',
      description: 'Dùng cho trường hợp cần ngừng nhận đơn ngay trong thời gian xác minh.',
    },
  ],
};

const accountReasonSuggestions = {
  unlock: [
    {
      label: 'Đã xác minh danh tính',
      value:
        'Đã hoàn tất xác minh danh tính và không còn dấu hiệu truy cập trái phép vào tài khoản.',
      description: 'Dùng sau khi chủ tài khoản hoàn thành quy trình xác minh.',
    },
    {
      label: 'Đã xử lý vi phạm',
      value:
        'Đã hoàn tất xử lý vi phạm; người dùng cam kết tuân thủ chính sách và đủ điều kiện mở lại tài khoản.',
      description: 'Dùng khi thời hạn xử lý đã kết thúc và các yêu cầu đã được đáp ứng.',
    },
    {
      label: 'Kết thúc điều tra',
      value:
        'Kết quả xác minh không phát hiện vi phạm; khôi phục toàn bộ quyền truy cập tài khoản.',
      description: 'Dùng khi phản ánh hoặc tín hiệu rủi ro không có căn cứ.',
    },
  ],
  lock: [
    {
      label: 'Dấu hiệu gian lận',
      value:
        'Tạm khóa tài khoản để điều tra dấu hiệu gian lận, giả mạo thông tin hoặc giao dịch bất thường.',
      description: 'Nên bổ sung mã giao dịch hoặc mã vụ việc liên quan.',
    },
    {
      label: 'Vi phạm an toàn',
      value:
        'Khóa tài khoản do vi phạm nghiêm trọng quy định an toàn và tiêu chuẩn cộng đồng của Lambe.',
      description: 'Dùng cho vi phạm có căn cứ và cần ngăn truy cập ngay.',
    },
    {
      label: 'Nhiều khiếu nại',
      value:
        'Tạm khóa tài khoản sau nhiều khiếu nại có căn cứ trong thời gian ngắn để phục vụ xác minh.',
      description: 'Nên ghi thêm số lượng khiếu nại và khoảng thời gian phát sinh.',
    },
    {
      label: 'Theo yêu cầu chính chủ',
      value:
        'Khóa tài khoản theo yêu cầu đã được xác thực của chính chủ để bảo vệ thông tin và quyền truy cập.',
      description: 'Dùng khi người dùng chủ động yêu cầu khóa tài khoản.',
    },
  ],
};

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
    updateProviderAccountStatus,
    syncProviderAvatar,
  } = useAdminProviders();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminProviderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const canManage = (account?.roles ?? []).some((role) => ['ADMIN', 'MODERATOR'].includes(role));
  const canManageAccounts = (account?.roles ?? []).some((role) =>
    ['ADMIN', 'SUPPORT'].includes(role),
  );

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
      inputLabel: 'Lý do thay đổi trạng thái',
      inputPlaceholder: 'Mô tả căn cứ xử lý, mã vụ việc và thông tin cần lưu ý...',
      inputDefaultValue: '',
      inputRequired: true,
      inputMinLength: 10,
      inputMaxLength: 500,
      inputSuggestions: restore
        ? activityReasonSuggestions.restore
        : activityReasonSuggestions.suspend,
      confirmText: restore ? 'Khôi phục' : 'Đình chỉ',
      onConfirm: async (reason) => {
        if (!reason) return false;
        try {
          const updated = await updateProviderStatus(
            provider.id,
            restore ? 'ACTIVE' : 'SUSPENDED',
            reason,
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

  const confirmAccountStatusChange = (
    provider: AdminProvider | AdminProviderDetail,
  ) => {
    const unlock = provider.user.status === 'BLOCKED';
    showDialog({
      title: unlock ? 'Mở khóa tài khoản' : 'Khóa tài khoản',
      message: unlock
        ? `Khôi phục quyền đăng nhập cho tài khoản ${provider.displayName}. Vui lòng ghi lý do:`
        : `Khóa toàn bộ quyền đăng nhập của ${provider.displayName}. Trạng thái provider được quản lý riêng. Vui lòng ghi lý do:`,
      type: unlock ? 'success' : 'warning',
      withInput: true,
      inputLabel: 'Lý do thay đổi quyền truy cập',
      inputPlaceholder: 'Mô tả căn cứ xử lý, mã vụ việc và thông tin cần lưu ý...',
      inputDefaultValue: '',
      inputRequired: true,
      inputMinLength: 10,
      inputMaxLength: 500,
      inputSuggestions: unlock
        ? accountReasonSuggestions.unlock
        : accountReasonSuggestions.lock,
      confirmText: unlock ? 'Mở khóa' : 'Khóa tài khoản',
      onConfirm: async (reason) => {
        if (!reason) return false;
        try {
          const status = await updateProviderAccountStatus(
            provider.user.id,
            unlock ? 'ACTIVE' : 'BLOCKED',
            reason,
          );
          if (selectedId === provider.id) {
            setDetail((current) =>
              current
                ? { ...current, user: { ...current.user, status } }
                : current,
            );
          }
          showDialog({
            title: 'Đã cập nhật',
            message: unlock
              ? 'Tài khoản đã được mở khóa.'
              : 'Tài khoản đã bị khóa.',
            type: 'success',
          });
        } catch (requestError) {
          showDialog({
            title: 'Không thể cập nhật',
            message:
              requestError instanceof Error
                ? requestError.message
                : 'Có lỗi xảy ra khi cập nhật tài khoản.',
            type: 'error',
          });
        }
      },
    });
  };

  const handleSyncAvatar = async (provider: AdminProviderDetail) => {
    try {
      const updated = await syncProviderAvatar(provider.id);
      setDetail(updated);
      showDialog({
        title: 'Đã đồng bộ ảnh đại diện',
        message:
          'Ảnh chân dung đã xác minh đã được gán cho tài khoản và hồ sơ provider.',
        type: 'success',
      });
    } catch (requestError) {
      showDialog({
        title: 'Không thể đồng bộ ảnh',
        message:
          requestError instanceof Error
            ? requestError.message
            : 'Ảnh chân dung không đủ điều kiện để đồng bộ.',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-950">Chuyên viên & đối tác</h1>
            <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-bold text-teal-800 ring-1 ring-teal-200">
              {summary.total} hồ sơ
            </span>
          </div>
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

      <nav className="flex w-fit max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-1" aria-label="Phân loại nhà cung cấp">
        <TypeTab active={providerType === 'ALL'} icon={<UsersRound className="h-4 w-4" />} label="Tất cả" count={summary.total} onClick={() => selectProviderType('ALL')} />
        <TypeTab active={providerType === 'INDIVIDUAL'} icon={<UserRound className="h-4 w-4" />} label="Chuyên viên" count={summary.individuals} onClick={() => selectProviderType('INDIVIDUAL')} />
        <TypeTab active={providerType === 'ORGANIZATION'} icon={<Building2 className="h-4 w-4" />} label="Đối tác" count={summary.organizations} onClick={() => selectProviderType('ORGANIZATION')} />
      </nav>

      <section className="grid divide-y divide-slate-200 border-y border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Metric icon={<BadgeCheck className="h-5 w-5 text-emerald-700" />} label="Đang hoạt động" value={summary.active} />
        <Metric icon={<Clock3 className="h-5 w-5 text-amber-700" />} label="Chờ thiết lập" value={summary.setupRequired} />
        <Metric icon={<CirclePause className="h-5 w-5 text-rose-700" />} label="Đã đình chỉ" value={summary.suspended} />
      </section>

      <section className="flex flex-col gap-3 border-b border-slate-200 bg-white pb-4 sm:flex-row sm:items-center">
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
        canManageAccounts={canManageAccounts}
        onView={(provider) => void openDetail(provider)}
        onStatusChange={confirmStatusChange}
        onAccountStatusChange={confirmAccountStatusChange}
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
          canManageAccounts={canManageAccounts}
          actionLoading={Boolean(activeAction)}
          onClose={() => {
            setSelectedId(null);
            setDetail(null);
          }}
          onStatusChange={confirmStatusChange}
          onAccountStatusChange={confirmAccountStatusChange}
          onSyncAvatar={(provider) => void handleSyncAvatar(provider)}
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
      className={`flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
        active ? 'bg-white text-teal-800 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
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

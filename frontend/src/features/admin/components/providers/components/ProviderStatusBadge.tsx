import type { ProviderProfileStatus } from '../../../hooks/useAdminProviders';

const styles: Record<ProviderProfileStatus, string> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  SETUP_REQUIRED: 'border-amber-200 bg-amber-50 text-amber-800',
  SUSPENDED: 'border-rose-200 bg-rose-50 text-rose-700',
};

const labels: Record<ProviderProfileStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  SETUP_REQUIRED: 'Chờ thiết lập',
  SUSPENDED: 'Đã đình chỉ',
};

export function ProviderStatusBadge({ status }: { status: ProviderProfileStatus }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

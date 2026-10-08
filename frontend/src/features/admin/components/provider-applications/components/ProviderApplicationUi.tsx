import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock3,
  FileClock,
  RotateCcw,
} from 'lucide-react';
import type {
  ProviderApplicationStatus,
  ReviewStatus,
} from '../../../hooks/useProviderApplications';

const applicationStatusConfig: Record<
  ProviderApplicationStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  DRAFT: {
    label: 'Bản nháp',
    className: 'border-slate-200 bg-slate-50 text-slate-700',
    icon: FileClock,
  },
  PENDING_REVIEW: {
    label: 'Chờ duyệt',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: Clock3,
  },
  NEEDS_CHANGES: {
    label: 'Cần bổ sung',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
    icon: RotateCcw,
  },
  APPROVED: {
    label: 'Đã duyệt',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  REJECTED: {
    label: 'Đã từ chối',
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    icon: Ban,
  },
  WITHDRAWN: {
    label: 'Đã rút',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    icon: Ban,
  },
};

const reviewStatusConfig: Record<
  ReviewStatus,
  { label: string; className: string }
> = {
  PENDING: {
    label: 'Chưa xử lý',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  VERIFIED: {
    label: 'Đã xác minh',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  NEEDS_CHANGES: {
    label: 'Cần bổ sung',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  REJECTED: {
    label: 'Không đạt',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

export function ApplicationStatusBadge({
  status,
}: {
  status: ProviderApplicationStatus;
}) {
  const config = applicationStatusConfig[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const config = reviewStatusConfig[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-slate-800 sm:px-5">
        <span className="text-teal-700">{icon}</span>
        <h2 className="font-bold">{title}</h2>
      </header>
      {children}
    </section>
  );
}

export function InfoItem({
  label,
  value,
  icon,
  sensitive = false,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
  sensitive?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
        {icon}
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-sm font-semibold text-slate-900 ${
          sensitive ? "font-mono" : ""
        }`}
      >
        {value || "Chưa cập nhật"}
      </dd>
    </div>
  );
}

export type ReviewDecisionStatus = Exclude<ReviewStatus, "PENDING">;

export function ReviewRow({
  title,
  status,
  note,
  reviewer,
  reviewedAt,
  disabled,
  loading,
  onReview,
}: {
  title: string;
  status: ReviewStatus;
  note?: string | null;
  reviewer?: string | null;
  reviewedAt?: string | null;
  disabled: boolean;
  loading: boolean;
  onReview: (status: ReviewDecisionStatus) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <ReviewStatusBadge status={status} />
        </div>
        {(note || reviewer) && (
          <p className="mt-1.5 text-sm text-slate-600">
            {note || "Không có nhận xét"}
            {reviewer ? ` · ${reviewer}` : ""}
            {reviewedAt ? ` · ${new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(reviewedAt))}` : ""}
          </p>
        )}
      </div>
      {loading ? (
        <div className="flex shrink-0 items-center gap-1">
           <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
        </div>
      ) : (
        <ReviewButtons disabled={disabled} onReview={onReview} />
      )}
    </div>
  );
}

export function ReviewButtons({
  disabled,
  verifyDisabled = false,
  verifyDisabledReason,
  onReview,
}: {
  disabled: boolean;
  verifyDisabled?: boolean;
  verifyDisabledReason?: string;
  onReview: (status: ReviewDecisionStatus) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        title={verifyDisabledReason || "Xác minh"}
        disabled={disabled || verifyDisabled}
        onClick={() => onReview("VERIFIED")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 disabled:opacity-35"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </button>
      <button
        type="button"
        title="Yêu cầu bổ sung"
        disabled={disabled}
        onClick={() => onReview("NEEDS_CHANGES")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-700 hover:bg-amber-50 disabled:opacity-35"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Không đạt"
        disabled={disabled}
        onClick={() => onReview("REJECTED")}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50 disabled:opacity-35"
      >
        <Ban className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SuggestionStatus({
  status,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const styles = {
    PENDING: "bg-amber-50 text-amber-800 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const labels = {
    PENDING: "Chờ xử lý",
    APPROVED: "Đã tạo dịch vụ",
    REJECTED: "Đã từ chối",
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

export function TimelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

export function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="px-5 py-10 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

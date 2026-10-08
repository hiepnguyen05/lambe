import {
  ArrowLeft,
  BriefcaseBusiness,
  FileCheck2,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type {
  ProviderApplicationDetail,
  ProviderDocumentAccess,
} from '../../../hooks/useProviderApplications';
import { ApplicationStatusBadge } from './ProviderApplicationUi';
import { formatDate } from './providerApplicationFormatters';

interface ApplicantResumeHeaderProps {
  application: ProviderApplicationDetail;
  portraitAccess?: ProviderDocumentAccess;
  portraitLoading: boolean;
  activeAction: boolean;
  verifiedChecks: number;
  totalChecks: number;
  verifiedDocuments: number;
  totalDocuments: number;
  verifiedServices: number;
  onBack: () => void;
  onRefresh: () => void;
  onOpenPortrait?: () => void;
}

export function ApplicantResumeHeader({
  application,
  portraitAccess,
  portraitLoading,
  activeAction,
  verifiedChecks,
  totalChecks,
  verifiedDocuments,
  totalDocuments,
  verifiedServices,
  onBack,
  onRefresh,
  onOpenPortrait,
}: ApplicantResumeHeaderProps) {
  const displayName =
    application.providerType === 'ORGANIZATION'
      ? application.organizationName || application.legalFullName
      : application.legalFullName;
  const reviewProgress = totalChecks > 0
    ? Math.round((verifiedChecks / totalChecks) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#0f766e]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Hồ sơ đăng ký đối tác
          </button>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Chi tiết kiểm duyệt
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Đối chiếu thông tin, tài liệu và năng lực trước khi ra quyết định.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={activeAction}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${activeAction ? 'animate-spin' : ''}`} />
          Làm mới hồ sơ
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 lg:grid-cols-[132px_minmax(0,1fr)_260px] lg:items-center">
          <div className="flex justify-center lg:justify-start">
            <button
              type="button"
              title={portraitAccess ? 'Xem ảnh chân dung' : 'Chưa có ảnh chân dung'}
              disabled={!portraitAccess || !onOpenPortrait}
              onClick={onOpenPortrait}
              className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md ring-1 ring-slate-200 transition hover:ring-2 hover:ring-[#0f766e]/40 disabled:cursor-default"
            >
              {portraitAccess ? (
                <img
                  src={portraitAccess.url}
                  alt={`Ảnh chân dung ${displayName || ''}`}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : portraitLoading ? (
                <LoaderCircle className="h-6 w-6 animate-spin text-[#0f766e]" />
              ) : (
                <UserRound className="h-11 w-11 text-slate-400" />
              )}
              {portraitAccess && (
                <span className="absolute inset-x-0 bottom-0 bg-slate-950/65 py-1 text-[10px] font-semibold text-white">
                  Xem ảnh
                </span>
              )}
            </button>
          </div>

          <div className="min-w-0 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
              <h2 className="truncate text-xl font-extrabold text-slate-900 sm:text-2xl">
                {displayName || 'Hồ sơ chưa có tên'}
              </h2>
              <ApplicationStatusBadge status={application.status} />
            </div>
            <p className="mt-1.5 text-sm font-semibold text-[#0f766e]">
              {application.providerType === 'INDIVIDUAL'
                ? 'Đối tác cá nhân'
                : 'Đối tác tổ chức'}
              {application.experienceYears != null
                ? ` · ${application.experienceYears} năm kinh nghiệm`
                : ''}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-slate-600 lg:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#0f766e]" />
                {application.user.phone || 'Chưa có số điện thoại'}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[#0f766e]" />
                <span className="truncate">{application.email || 'Chưa có email'}</span>
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Nộp {formatDate(application.submittedAt, true)} · Lần sửa #{application.revisionNumber} · Mã {application.id.slice(0, 8).toUpperCase()}
            </p>
          </div>

          <div className="border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">Tiến độ thẩm định</span>
              <span className="font-bold text-[#0f766e]">{reviewProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#0f766e] transition-all"
                style={{ width: `${reviewProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {verifiedChecks}/{totalChecks} hạng mục đã xác minh. Kiểm tra đủ tài liệu trước khi duyệt hồ sơ.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 bg-slate-50/70">
          <ResumeMetric
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label="Hạng mục đạt"
            value={`${verifiedChecks}/${totalChecks}`}
          />
          <ResumeMetric
            icon={<FileCheck2 className="h-3.5 w-3.5" />}
            label="Tài liệu đạt"
            value={`${verifiedDocuments}/${totalDocuments}`}
          />
          <ResumeMetric
            icon={<BriefcaseBusiness className="h-3.5 w-3.5" />}
            label="Dịch vụ đạt"
            value={verifiedServices.toString()}
          />
        </div>
      </section>
    </div>
  );
}

function ResumeMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-lg font-extrabold text-slate-900">{value}</p>
    </div>
  );
}

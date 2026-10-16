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
            className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại danh sách
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hồ sơ năng lực
          </h1>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={activeAction}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${activeAction ? 'animate-spin text-slate-400' : 'text-slate-400'}`} />
          Làm mới dữ liệu
        </button>
      </div>

      <section className="mb-6 flex flex-col md:flex-row md:items-start gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* Avatar */}
        <div className="shrink-0 flex justify-center md:justify-start">
          <button
            type="button"
            title={portraitAccess ? 'Xem ảnh chân dung' : 'Chưa có ảnh chân dung'}
            disabled={!portraitAccess || !onOpenPortrait}
            onClick={onOpenPortrait}
            className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 transition hover:border-slate-300 disabled:cursor-default"
          >
            {portraitAccess ? (
              <img
                src={portraitAccess.url}
                alt={`Ảnh chân dung ${displayName || ''}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : portraitLoading ? (
              <LoaderCircle className="h-6 w-6 animate-spin text-slate-400" />
            ) : (
              <UserRound className="h-10 w-10 text-slate-300" />
            )}
            {portraitAccess && (
              <div className="absolute inset-0 bg-slate-900/0 transition-colors group-hover:bg-slate-900/10">
                <span className="absolute inset-x-0 bottom-0 translate-y-full bg-slate-900/70 py-1.5 text-center text-[10px] font-semibold text-white transition-transform group-hover:translate-y-0">
                  Xem ảnh
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Basic Info */}
        <div className="flex-1 min-w-0 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900 truncate">
              {displayName || 'Chưa cập nhật tên'}
            </h2>
            <ApplicationStatusBadge status={application.status} />
          </div>
          
          <p className="mt-1 text-sm font-medium text-slate-500">
            {application.providerType === 'INDIVIDUAL'
              ? 'Đối tác cá nhân'
              : 'Đối tác tổ chức'}
            {application.experienceYears != null
              ? ` • ${application.experienceYears} năm kinh nghiệm`
              : ''}
          </p>
          
          <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400" />
              {application.user.phone || 'Chưa có SĐT'}
            </span>
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400" />
              {application.email || 'Chưa có Email'}
            </span>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Mã hồ sơ: <span className="font-mono text-slate-500">{application.id.slice(0, 8).toUpperCase()}</span> • Nộp lúc: {formatDate(application.submittedAt, true)}
          </p>
        </div>

        {/* Metrics Column */}
        <div className="shrink-0 w-full md:w-64 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 space-y-4">
          
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-600">Tiến độ hồ sơ</span>
              <span className="font-bold text-slate-900">{reviewProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-500"
                style={{ width: `${reviewProgress}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 p-2 text-center">
              <ShieldCheck className="h-4 w-4 text-slate-400 mb-1" />
              <span className="text-sm font-bold text-slate-900">{verifiedChecks}/{totalChecks}</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 p-2 text-center">
              <FileCheck2 className="h-4 w-4 text-slate-400 mb-1" />
              <span className="text-sm font-bold text-slate-900">{verifiedDocuments}/{totalDocuments}</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-lg bg-slate-50 p-2 text-center">
              <BriefcaseBusiness className="h-4 w-4 text-slate-400 mb-1" />
              <span className="text-sm font-bold text-slate-900">{verifiedServices}</span>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}

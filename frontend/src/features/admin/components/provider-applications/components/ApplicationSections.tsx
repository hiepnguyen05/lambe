import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCheck,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Images,
  Lightbulb,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  UserRound,
  X,
} from "lucide-react";
import {
  Panel,
  InfoItem,
  ReviewRow,
  ReviewStatusBadge,
  ReviewButtons,
  SuggestionStatus,
  TimelineItem,
  EmptyMessage,
  type ReviewDecisionStatus,
  ApplicationStatusBadge,
} from "./ProviderApplicationUi";
import {
  documentLabels,
  formatDate,
  formatMoney,
  sectionLabels,
  getDocumentStatusCounts,
  getLatestDocumentDate,
  getServiceVerificationIssue,
  genderLabel,
} from "./providerApplicationFormatters";
import { DocumentThumbnail } from "./DocumentThumbnail";
import { DocumentGalleryThumbnail } from "./DocumentGalleryThumbnail";
import type {
  ProviderApplicationDetail,
  ProviderApplicationSection,
  ProviderDocument,
  ProviderApplicationService,
  ProviderServiceSuggestion,
  ProviderDocumentAccess,
  ReviewStatus,
} from "../../../hooks/useProviderApplications";

export function ApplicationInfoSection({
  application,
}: {
  application: ProviderApplicationDetail;
}) {
  return (
    <Panel title="Thông tin đăng ký" icon={<UserRound className="h-5 w-5" />}>
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <InfoItem label="Tên pháp lý" value={application.legalFullName} />
        <InfoItem
          label="Loại hình"
          value={
            application.providerType === "INDIVIDUAL" ? "Cá nhân" : "Tổ chức"
          }
        />
        <InfoItem
          label="CCCD / Định danh"
          value={application.nationalIdNumber || application.nationalIdMasked}
          sensitive
        />
        <InfoItem label="Ngày sinh" value={formatDate(application.birthDate)} />
        <InfoItem label="Giới tính" value={genderLabel(application.gender)} />
        <InfoItem
          label="Kinh nghiệm"
          value={
            application.experienceYears == null
              ? null
              : `${application.experienceYears} năm`
          }
        />
        <InfoItem
          label="Email"
          value={application.email}
          icon={<Mail className="h-4 w-4" />}
        />
        <InfoItem
          label="Số điện thoại"
          value={application.user.phone}
          icon={<Phone className="h-4 w-4" />}
        />
        {application.providerType === "ORGANIZATION" && (
          <>
            <InfoItem
              label="Tên tổ chức"
              value={application.organizationName}
            />
            <InfoItem label="Mã số thuế" value={application.taxCode} />
            <InfoItem
              label="Số đăng ký kinh doanh"
              value={application.businessRegistrationNumber}
            />
            <InfoItem
              label="Người đại diện"
              value={application.representativeName}
            />
            <InfoItem
              label="Địa chỉ đăng ký"
              value={application.registeredAddress}
            />
          </>
        )}
        <div className="sm:col-span-2 lg:col-span-3">
          <InfoItem
            label="Giới thiệu kinh nghiệm"
            value={application.biography}
          />
        </div>
      </div>
    </Panel>
  );
}

export function ChecklistSection({
  checks,
  canReviewKyc,
  canReviewServices,
  canEdit,
  activeAction,
  onReview,
}: {
  checks: NonNullable<ProviderApplicationDetail["checks"]>;
  canReviewKyc: boolean;
  canReviewServices: boolean;
  canEdit: boolean;
  activeAction: string | null;
  onReview: (
    section: ProviderApplicationSection,
    label: string,
    status: ReviewDecisionStatus,
    note: string | null | undefined
  ) => void;
}) {
  if (checks.length === 0) return null;

  return (
    <Panel title="Hạng mục kiểm duyệt" icon={<BadgeCheck className="h-5 w-5" />}>
      <div className="divide-y divide-slate-100">
        {checks.map((check) => {
          const allowed =
            canReviewKyc ||
            (canReviewServices &&
              ["SERVICES", "EXPERTISE"].includes(check.section));
          return (
            <ReviewRow
              key={check.id}
              title={sectionLabels[check.section]}
              status={check.status}
              note={check.reviewNote}
              reviewer={
                check.reviewedBy?.fullName || check.reviewedBy?.username
              }
              reviewedAt={check.reviewedAt}
              disabled={!canEdit || !allowed || Boolean(activeAction)}
              loading={activeAction === `check:${check.section}`}
              onReview={(status) =>
                onReview(
                  check.section,
                  sectionLabels[check.section],
                  status,
                  check.reviewNote
                )
              }
            />
          );
        })}
      </div>
    </Panel>
  );
}

export function DocumentsSection({
  documents,
  standaloneDocuments,
  portfolioDocuments,
  documentPreviews,
  documentPreviewsLoading,
  documentPreviewsError,
  canEdit,
  activeAction,
  openDocument,
  reviewDocument,
  refetchDocumentPreviews,
}: {
  documents: ProviderDocument[];
  standaloneDocuments: ProviderDocument[];
  portfolioDocuments: ProviderDocument[];
  documentPreviews: Record<string, ProviderDocumentAccess>;
  documentPreviewsLoading: boolean;
  documentPreviewsError: string | null;
  canEdit: boolean;
  activeAction: string | null;
  openDocument: (id: string) => void;
  reviewDocument: (doc: ProviderDocument, status: ReviewDecisionStatus) => void;
  refetchDocumentPreviews: () => void;
}) {
  return (
    <Panel title="Tài liệu KYC" icon={<FileText className="h-5 w-5" />}>
      {documents.length === 0 ? (
        <EmptyMessage message="Hồ sơ chưa có tài liệu." />
      ) : (
        <div className="divide-y divide-slate-100">
          {documentPreviewsError && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5">
              <span>{documentPreviewsError}</span>
              <button
                type="button"
                onClick={refetchDocumentPreviews}
                className="inline-flex items-center gap-1.5 font-semibold hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tải lại ảnh
              </button>
            </div>
          )}
          {standaloneDocuments.map((document) => (
            <div key={document.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <DocumentThumbnail
                  access={documentPreviews[document.id]}
                  isLoading={documentPreviewsLoading}
                  hasError={Boolean(documentPreviewsError)}
                  label={documentLabels[document.type] || document.type}
                  onOpen={() => openDocument(document.id)}
                  onRetry={refetchDocumentPreviews}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {documentLabels[document.type] || document.type}
                      </h3>
                      <ReviewStatusBadge status={document.status} />
                      {document.isPublicCandidate && (
                        <span className="text-xs font-semibold text-sky-700">
                          Ứng viên ảnh công khai
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Tải lên {formatDate(document.createdAt, true)}
                    </p>
                    {document.reviewNote && (
                      <p className="mt-2 text-sm text-slate-600">
                        Nhận xét: {document.reviewNote}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      title="Xem tài liệu bảo mật"
                      disabled={Boolean(activeAction)}
                      onClick={() => openDocument(document.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {activeAction === `access:${document.id}` ? (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      Xem tài liệu
                    </button>
                    <ReviewButtons
                      disabled={!canEdit || Boolean(activeAction)}
                      onReview={(status) => reviewDocument(document, status)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {portfolioDocuments.length > 0 && (
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <DocumentGalleryThumbnail
                  documents={portfolioDocuments}
                  accesses={documentPreviews}
                  isLoading={documentPreviewsLoading}
                  hasError={Boolean(documentPreviewsError)}
                  disabled={Boolean(activeAction)}
                  onOpen={() => openDocument(portfolioDocuments[0].id)}
                  onRetry={refetchDocumentPreviews}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        Hồ sơ năng lực
                      </h3>
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        <Images className="h-3.5 w-3.5" />
                        {portfolioDocuments.length} ảnh
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {getDocumentStatusCounts(portfolioDocuments).map(
                        ({ status, count }) => (
                          <span
                            key={status}
                            className="inline-flex items-center gap-1.5"
                          >
                            <ReviewStatusBadge status={status} />
                            <span className="text-xs text-slate-500">
                              {count} ảnh
                            </span>
                          </span>
                        )
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Cập nhật gần nhất{" "}
                      {formatDate(
                        getLatestDocumentDate(portfolioDocuments),
                        true
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={() => openDocument(portfolioDocuments[0].id)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 self-start rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    {activeAction === `access:${portfolioDocuments[0].id}` ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Images className="h-3.5 w-3.5" />
                    )}
                    Xem {portfolioDocuments.length} ảnh
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export function ServicesSection({
  services,
  documents,
  experienceYears,
  canReviewServices,
  canEdit,
  activeAction,
  onReview,
}: {
  services: ProviderApplicationService[];
  documents: ProviderDocument[];
  experienceYears: number | null;
  canReviewServices: boolean;
  canEdit: boolean;
  activeAction: string | null;
  onReview: (
    item: ProviderApplicationService,
    status: ReviewDecisionStatus
  ) => void;
}) {
  return (
    <Panel
      title="Dịch vụ đăng ký"
      icon={<BriefcaseBusiness className="h-5 w-5" />}
    >
      {services.length === 0 ? (
        <EmptyMessage message="Hồ sơ chưa đăng ký dịch vụ." />
      ) : (
        <div className="divide-y divide-slate-100">
          {services.map((item) => {
            const verificationIssue = getServiceVerificationIssue(
              item,
              documents,
              experienceYears
            );
            return (
              <div key={item.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {item.service.name}
                      </h3>
                      <ReviewStatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.service.category.name} · {item.service.code}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
                      <span className="font-semibold text-teal-800">
                        {formatMoney(
                          item.proposedPriceAmount,
                          item.service.currencyCode
                        )}
                      </span>
                      <span>
                        {item.durationMinutes
                          ? `${item.durationMinutes} phút`
                          : "Chưa có thời lượng"}
                      </span>
                      <span>
                        Giá hệ thống {formatMoney(item.service.minPriceAmount)}
                        –{formatMoney(item.service.maxPriceAmount)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-2 text-sm leading-5 text-slate-600">
                        {item.description}
                      </p>
                    )}
                    {item.reviewNote && (
                      <p className="mt-2 text-sm text-amber-800">
                        Nhận xét: {item.reviewNote}
                      </p>
                    )}
                    {verificationIssue && item.status === "PENDING" && (
                      <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        Chưa thể xác minh: {verificationIssue}
                      </p>
                    )}
                  </div>
                  {canReviewServices && (
                    <ReviewButtons
                      disabled={!canEdit || Boolean(activeAction)}
                      verifyDisabled={Boolean(verificationIssue)}
                      verifyDisabledReason={verificationIssue ?? undefined}
                      onReview={(status) => onReview(item, status)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

export function SuggestionsSection({
  suggestions,
  isAdmin,
  canEdit,
  activeAction,
  onApprove,
  onReject,
}: {
  suggestions: ProviderServiceSuggestion[];
  isAdmin: boolean;
  canEdit: boolean;
  activeAction: string | null;
  onApprove: (suggestion: ProviderServiceSuggestion) => void;
  onReject: (suggestion: ProviderServiceSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <Panel
      title="Đề xuất dịch vụ mới"
      icon={<Lightbulb className="h-5 w-5" />}
    >
      <div className="divide-y divide-slate-100">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">
                    {suggestion.name}
                  </h3>
                  <SuggestionStatus status={suggestion.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {suggestion.category?.name || "Danh mục chưa hiển thị"}
                </p>
                <p className="mt-2 text-sm font-semibold text-teal-800">
                  {formatMoney(suggestion.proposedPriceAmount)}
                  {suggestion.durationMinutes
                    ? ` · ${suggestion.durationMinutes} phút`
                    : ""}
                </p>
                {suggestion.description && (
                  <p className="mt-2 text-sm text-slate-600">
                    {suggestion.description}
                  </p>
                )}
                {suggestion.reviewNote && (
                  <p className="mt-2 text-sm text-rose-700">
                    Nhận xét: {suggestion.reviewNote}
                  </p>
                )}
              </div>
              {isAdmin && canEdit && suggestion.status === "PENDING" && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={() => onApprove(suggestion)}
                    className="rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    Tạo dịch vụ
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={() => onReject(suggestion)}
                    className="rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function ApprovalSidebar({
  application,
  canReviewKyc,
  approvalBlockers,
  bulkPendingCount,
  activeAction,
  hasNeedsChanges,
  openBulkReview,
  openDecision,
}: {
  application: ProviderApplicationDetail;
  canReviewKyc: boolean;
  approvalBlockers: string[];
  bulkPendingCount: number;
  activeAction: string | null;
  hasNeedsChanges: boolean;
  openBulkReview: () => void;
  openDecision: (type: "approve" | "changes" | "reject") => void;
}) {
  return (
    <aside className="space-y-5">
      <section className="sticky top-5 rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-bold text-slate-900">Quyết định xét duyệt</h2>
          <p className="mt-1 text-xs text-slate-500">
            Kiểm tra toàn bộ điều kiện trước khi kết thúc hồ sơ.
          </p>
        </header>
        <div className="space-y-4 p-4">
          {application.status === "PENDING_REVIEW" && canReviewKyc ? (
            <>
              {approvalBlockers.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  Hồ sơ đã đủ điều kiện sơ bộ để phê duyệt.
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    Còn {approvalBlockers.length} điều kiện
                  </p>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-800">
                    {approvalBlockers.map((blocker) => (
                      <li key={blocker}>• {blocker}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                disabled={bulkPendingCount === 0 || Boolean(activeAction)}
                onClick={openBulkReview}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-teal-300 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-800 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCheck className="h-4 w-4" />
                Duyệt tất cả mục hợp lệ
              </button>

              <button
                type="button"
                disabled={approvalBlockers.length > 0 || Boolean(activeAction)}
                onClick={() => openDecision("approve")}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCircle2 className="h-4 w-4" />
                Phê duyệt hồ sơ
              </button>
              <button
                type="button"
                disabled={!hasNeedsChanges || Boolean(activeAction)}
                onClick={() => openDecision("changes")}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <RotateCcw className="h-4 w-4" />
                Yêu cầu bổ sung
              </button>
              <button
                type="button"
                disabled={Boolean(activeAction)}
                onClick={() => openDecision("reject")}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-45"
              >
                <X className="h-4 w-4" />
                Từ chối hồ sơ
              </button>
              {!hasNeedsChanges && (
                <p className="text-xs leading-5 text-slate-500">
                  Để yêu cầu bổ sung, hãy đánh dấu ít nhất một hạng mục, tài
                  liệu hoặc dịch vụ là “Cần bổ sung”.
                </p>
              )}
            </>
          ) : application.status === "PENDING_REVIEW" ? (
            <p className="text-sm leading-6 text-slate-600">
              Tài khoản hiện tại chỉ có quyền xem hoặc kiểm duyệt dịch vụ.
              Quyết định cuối cần reviewer KYC.
            </p>
          ) : (
            <div className="space-y-3">
              <ApplicationStatusBadge status={application.status} />
              {application.decisionReason && (
                <p className="rounded-lg bg-slate-50 p-3 text-sm leading-5 text-slate-700">
                  {application.decisionReason}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Xử lý lúc {formatDate(application.reviewedAt, true)}
                {application.reviewedBy
                  ? ` bởi ${
                      application.reviewedBy.fullName ||
                      application.reviewedBy.username
                    }`
                  : ""}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <History className="h-4 w-4 text-slate-500" />
          Dấu thời gian
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <TimelineItem
            label="Khởi tạo"
            value={formatDate(application.createdAt, true)}
          />
          <TimelineItem
            label="Gửi xét duyệt"
            value={formatDate(application.submittedAt, true)}
          />
          <TimelineItem
            label="Cập nhật gần nhất"
            value={formatDate(application.updatedAt, true)}
          />
          {application.termsAcceptances?.[0] && (
            <TimelineItem
              label={`Chấp nhận điều khoản ${application.termsAcceptances[0].termsVersion}`}
              value={formatDate(
                application.termsAcceptances[0].acceptedAt,
                true
              )}
            />
          )}
        </dl>
      </section>
    </aside>
  );
}

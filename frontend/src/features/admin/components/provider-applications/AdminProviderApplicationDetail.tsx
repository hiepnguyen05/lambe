import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { LoaderCircle, CheckCircle2 } from "lucide-react";
import { useAdminAuth } from "../../hooks/useAdminAuth";
import {
  type ApproveServiceSuggestionInput,
  type ProviderApplicationSection,
  type ProviderServiceSuggestion,
  useProviderDocumentPreviews,
  useProviderApplicationDetail,
} from "../../hooks/useProviderApplications";
import { InlineError } from "./components/ProviderApplicationUi";
import { ReviewDialog } from "./components/ReviewDialog";
import { ServiceSuggestionServiceForm } from "./components/ServiceSuggestionServiceForm";
import { DocumentPreviewDialog } from "./components/DocumentPreviewDialog";
import { ApplicantResumeHeader } from "./components/ApplicantResumeHeader";
import {
  ApplicationInfoSection,
  ChecklistSection,
  DocumentsSection,
  ServicesSection,
  SuggestionsSection,
  ApprovalSidebar,
} from "./components/ApplicationSections";
import { useApplicationReviewActions } from "../../hooks/useApplicationReviewActions";

const requiredSections: ProviderApplicationSection[] = [
  "IDENTITY",
  "PORTRAIT",
  "EXPERTISE",
  "SERVICES",
  "TERMS",
];

export function AdminProviderApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { account } = useAdminAuth();
  
  const {
    application,
    isLoading,
    activeAction,
    error,
    refetch,
    updateSectionCheck,
    updateDocumentReview,
    updateServiceReview,
    accessDocument,
    approveServiceSuggestion,
    uploadServiceCoverImage,
    rejectServiceSuggestion,
    reviewAllEligible,
    approveApplication,
    requestChanges,
    rejectApplication,
  } = useProviderApplicationDetail(id);

  const [selectedSuggestion, setSelectedSuggestion] =
    useState<ProviderServiceSuggestion | null>(null);

  const { state: reviewState, setters: reviewSetters, handlers: reviewHandlers } = useApplicationReviewActions({
    accessDocument,
    updateDocumentReview,
    updateSectionCheck,
    updateServiceReview,
    approveApplication,
    requestChanges,
    rejectApplication,
    reviewAllEligible,
    rejectServiceSuggestion
  });

  const { pendingDialog, documentPreview, actionError, successMessage } = reviewState;
  const { setPendingDialog, setDocumentPreview } = reviewSetters;
  const { runAction, openItemReview, openDocument, reviewDocument, openDecision, openBulkReview } = reviewHandlers;

  const roles = account?.roles ?? [];
  const canReviewKyc = roles.some((role) =>
    ["ADMIN", "MODERATOR", "KYC_REVIEWER"].includes(role),
  );
  const canReviewServices = canReviewKyc || roles.includes("SERVICE_REVIEWER");
  const isAdmin = roles.includes("ADMIN");

  const {
    accesses: documentPreviews,
    isLoading: documentPreviewsLoading,
    error: documentPreviewsError,
    refetch: refetchDocumentPreviews,
  } = useProviderDocumentPreviews(id, canReviewKyc);

  const documents = application?.documents ?? [];
  const portfolioDocuments = documents.filter(
    (document) => document.type === "PORTFOLIO",
  );
  const standaloneDocuments = documents.filter(
    (document) => document.type !== "PORTFOLIO",
  );
  const checks = application?.checks ?? [];
  const suggestions = application?.serviceSuggestions ?? [];
  const previewDocument = documentPreview
    ? (documents.find(
        (document) => document.id === documentPreview.documentId,
      ) ?? null)
    : null;
  const previewDocuments =
    previewDocument?.type === "PORTFOLIO"
      ? portfolioDocuments
      : standaloneDocuments;
  const portraitDocument =
    documents.find((document) => document.type === "PORTRAIT") ??
    documents.find((document) => document.type === "IDENTITY_SELFIE") ??
    null;
  const portraitAccess = portraitDocument
    ? documentPreviews[portraitDocument.id]
    : undefined;
  const canEdit = application?.status === "PENDING_REVIEW";
  const bulkPendingCount =
    documents.filter((item) => item.status === "PENDING").length +
    checks.filter((item) => item.status === "PENDING").length +
    (application?.services.filter((item) => item.status === "PENDING").length ??
      0);

  const approvalBlockers = useMemo(() => {
    if (!application || !canReviewKyc) return [];
    const blockers: string[] = [];
    const applicationChecks = application.checks ?? [];
    const applicationDocuments = application.documents ?? [];
    const applicationSuggestions = application.serviceSuggestions ?? [];
    const unverifiedSections = requiredSections.filter(
      (section) =>
        !applicationChecks.some(
          (check) => check.section === section && check.status === "VERIFIED",
        ),
    );
    if (unverifiedSections.length > 0) {
      blockers.push(`${unverifiedSections.length} hạng mục chưa xác minh`);
    }
    const pendingDocuments = applicationDocuments.filter((item) =>
      ["PENDING", "NEEDS_CHANGES"].includes(item.status),
    ).length;
    if (pendingDocuments > 0) {
      blockers.push(`${pendingDocuments} tài liệu chưa xử lý xong`);
    }
    const pendingServices = application.services.filter((item) =>
      ["PENDING", "NEEDS_CHANGES"].includes(item.status),
    ).length;
    if (pendingServices > 0) {
      blockers.push(`${pendingServices} dịch vụ chưa xử lý xong`);
    }
    if (!application.services.some((item) => item.status === "VERIFIED")) {
      blockers.push("Chưa có dịch vụ nào được xác minh");
    }
    const pendingSuggestions = applicationSuggestions.filter(
      (item) => item.status === "PENDING",
    ).length;
    if (pendingSuggestions > 0) {
      blockers.push(`${pendingSuggestions} đề xuất dịch vụ đang chờ`);
    }
    return blockers;
  }, [application, canReviewKyc]);

  const hasNeedsChanges = [
    ...checks,
    ...documents,
    ...(application?.services ?? []),
  ].some((item) => item.status === "NEEDS_CHANGES");

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-slate-500">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-teal-700" />
        Đang tải hồ sơ...
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <InlineError message={error || "Không tìm thấy hồ sơ."} />
        <button
          type="button"
          onClick={() => navigate("/admin/provider-applications")}
          className="mt-5 text-sm font-semibold text-teal-800 hover:underline"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      <ApplicantResumeHeader
        application={application}
        portraitAccess={portraitAccess}
        portraitLoading={documentPreviewsLoading}
        activeAction={Boolean(activeAction)}
        verifiedChecks={
          checks.filter((item) => item.status === "VERIFIED").length
        }
        totalChecks={requiredSections.length}
        verifiedDocuments={
          documents.filter((item) => item.status === "VERIFIED").length
        }
        totalDocuments={documents.length}
        verifiedServices={
          application.services.filter((item) => item.status === "VERIFIED")
            .length
        }
        onBack={() => navigate("/admin/provider-applications")}
        onRefresh={() => {
          void refetch();
          void refetchDocumentPreviews();
        }}
        onOpenPortrait={
          portraitDocument
            ? () => void openDocument(portraitDocument.id)
            : undefined
        }
      />

      {actionError && <InlineError message={actionError} />}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-5">
          <ApplicationInfoSection application={application} />

          <ChecklistSection
            checks={checks}
            canReviewKyc={canReviewKyc}
            canReviewServices={canReviewServices}
            canEdit={canEdit}
            activeAction={activeAction}
            onReview={(section, label, status, note) =>
              openItemReview(
                label,
                status,
                note,
                (submitNote) =>
                  runAction(
                    () => updateSectionCheck(section, status, submitNote),
                    `Đã cập nhật ${label.toLowerCase()}.`
                  )
              )
            }
          />

          {canReviewKyc && (
            <DocumentsSection
              documents={documents}
              standaloneDocuments={standaloneDocuments}
              portfolioDocuments={portfolioDocuments}
              documentPreviews={documentPreviews}
              documentPreviewsLoading={documentPreviewsLoading}
              documentPreviewsError={documentPreviewsError}
              canEdit={canEdit}
              activeAction={activeAction}
              openDocument={(docId) => void openDocument(docId)}
              reviewDocument={reviewDocument}
              refetchDocumentPreviews={() => void refetchDocumentPreviews()}
            />
          )}

          <ServicesSection
            services={application.services}
            documents={documents}
            experienceYears={application.experienceYears}
            canReviewServices={canReviewServices}
            canEdit={canEdit}
            activeAction={activeAction}
            onReview={(item, status) =>
              openItemReview(
                item.service.name,
                status,
                item.reviewNote,
                (note) =>
                  runAction(
                    () => updateServiceReview(item.id, status, note),
                    "Đã cập nhật kết quả dịch vụ."
                  )
              )
            }
          />

          <SuggestionsSection
            suggestions={suggestions}
            isAdmin={isAdmin}
            canEdit={canEdit}
            activeAction={activeAction}
            onApprove={(suggestion) => setSelectedSuggestion(suggestion)}
            onReject={(suggestion) =>
              setPendingDialog({
                title: `Từ chối đề xuất “${suggestion.name}”`,
                description:
                  "Nêu rõ lý do để người đăng ký biết vì sao đề xuất không được chấp nhận.",
                confirmLabel: "Từ chối đề xuất",
                tone: "danger",
                noteRequired: true,
                initialNote: suggestion.reviewNote ?? "",
                submit: (note) =>
                  runAction(
                    () => rejectServiceSuggestion(suggestion.id, note),
                    "Đã từ chối đề xuất dịch vụ."
                  ),
              })
            }
          />
        </main>

        <ApprovalSidebar
          application={application}
          canReviewKyc={canReviewKyc}
          approvalBlockers={approvalBlockers}
          bulkPendingCount={bulkPendingCount}
          activeAction={activeAction}
          hasNeedsChanges={hasNeedsChanges}
          openBulkReview={openBulkReview}
          openDecision={openDecision}
        />
      </div>

      {documentPreview && previewDocument && (
        <DocumentPreviewDialog
          documents={previewDocuments}
          document={previewDocument}
          access={documentPreview.access}
          isLoading={activeAction?.startsWith("access:") ?? false}
          onNavigate={(document) => void openDocument(document.id)}
          onClose={() => {
            if (!activeAction) setDocumentPreview(null);
          }}
          reviewActions={
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                title="Xác minh"
                disabled={!canEdit || Boolean(activeAction)}
                onClick={() => reviewDocument(previewDocument, "VERIFIED")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 disabled:opacity-35"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </button>
              <button
                type="button"
                title="Yêu cầu bổ sung"
                disabled={!canEdit || Boolean(activeAction)}
                onClick={() => reviewDocument(previewDocument, "NEEDS_CHANGES")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-700 hover:bg-amber-50 disabled:opacity-35"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              <button
                type="button"
                title="Không đạt"
                disabled={!canEdit || Boolean(activeAction)}
                onClick={() => reviewDocument(previewDocument, "REJECTED")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50 disabled:opacity-35"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          }
        />
      )}

      <ReviewDialog
        open={Boolean(pendingDialog)}
        title={pendingDialog?.title ?? ""}
        description={pendingDialog?.description ?? ""}
        confirmLabel={pendingDialog?.confirmLabel ?? "Xác nhận"}
        tone={pendingDialog?.tone}
        noteRequired={pendingDialog?.noteRequired}
        initialNote={pendingDialog?.initialNote}
        isSubmitting={Boolean(activeAction)}
        onClose={() => {
          if (!activeAction) setPendingDialog(null);
        }}
        onConfirm={(note) => pendingDialog?.submit(note)}
      />

      <ServiceSuggestionServiceForm
        suggestion={selectedSuggestion}
        experienceYears={application?.experienceYears ?? null}
        documents={documents}
        isSubmitting={
          selectedSuggestion
            ? activeAction === `suggestion:${selectedSuggestion.id}`
            : false
        }
        onClose={() => {
          if (!activeAction) setSelectedSuggestion(null);
        }}
        uploadCoverImage={uploadServiceCoverImage}
        onSubmit={async (input: ApproveServiceSuggestionInput) => {
          if (!selectedSuggestion)
            throw new Error("Không tìm thấy đề xuất dịch vụ.");
          const result = await runAction(
            () => approveServiceSuggestion(selectedSuggestion.id, input),
            "Đã tạo và xác minh dịch vụ trong hồ sơ."
          );
          return result.service;
        }}
      />
    </div>
  );
}

import { useState } from "react";
import type { ReviewDecisionStatus } from "../components/provider-applications/components/ProviderApplicationUi";
import type {
  ProviderDocument,
  ProviderDocumentAccess,
} from "./useProviderApplications";
import { documentLabels } from "../components/provider-applications/components/providerApplicationFormatters";

export interface PendingDialog {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "success" | "warning" | "danger";
  noteRequired: boolean;
  initialNote?: string;
  submit: (note: string) => Promise<void>;
}

export function useApplicationReviewActions(actions: {
  accessDocument: (id: string) => Promise<ProviderDocumentAccess>;
  updateDocumentReview: (id: string, status: ReviewDecisionStatus, note?: string) => Promise<void>;
  updateSectionCheck: (section: any, status: ReviewDecisionStatus, note?: string) => Promise<void>;
  updateServiceReview: (id: string, status: ReviewDecisionStatus, note?: string) => Promise<void>;
  approveApplication: () => Promise<void>;
  requestChanges: (note: string) => Promise<void>;
  rejectApplication: (note: string) => Promise<void>;
  reviewAllEligible: () => Promise<any>;
  rejectServiceSuggestion: (id: string, note: string) => Promise<void>;
}) {
  const [pendingDialog, setPendingDialog] = useState<PendingDialog | null>(null);
  const [documentPreview, setDocumentPreview] = useState<{
    documentId: string;
    access: ProviderDocumentAccess;
  } | null>(null);
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const runAction = async <T,>(
    action: () => Promise<T>,
    message: string | ((result: T) => string),
  ): Promise<T> => {
    setActionError("");
    setSuccessMessage("");
    try {
      const result = await action();
      setSuccessMessage(
        typeof message === "function" ? message(result) : message,
      );
      setPendingDialog(null);
      return result;
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error
          ? actionFailure.message
          : "Không thể thực hiện thao tác.",
      );
      throw actionFailure;
    }
  };

  const openItemReview = (
    label: string,
    status: ReviewDecisionStatus,
    currentNote: string | null | undefined,
    submit: (note: string) => Promise<void>,
  ) => {
    const verified = status === "VERIFIED";
    const rejected = status === "REJECTED";
    setPendingDialog({
      title: verified
        ? `Xác minh ${label}`
        : rejected
          ? `Từ chối ${label}`
          : `Yêu cầu bổ sung ${label}`,
      description: verified
        ? "Xác nhận dữ liệu đã được đối chiếu và đáp ứng yêu cầu."
        : "Nhận xét sẽ được lưu vào hồ sơ để phục vụ xử lý tiếp theo.",
      confirmLabel: verified
        ? "Xác minh"
        : rejected
          ? "Từ chối"
          : "Đánh dấu cần bổ sung",
      tone: verified ? "success" : rejected ? "danger" : "warning",
      noteRequired: !verified,
      initialNote: currentNote ?? "",
      submit,
    });
  };

  const openDocument = async (documentId: string) => {
    setActionError("");
    try {
      const access = await actions.accessDocument(documentId);
      setDocumentPreview({ documentId, access });
    } catch (accessError) {
      setActionError(
        accessError instanceof Error
          ? accessError.message
          : "Không thể mở tài liệu.",
      );
    }
  };

  const reviewDocument = (
    document: ProviderDocument,
    status: ReviewDecisionStatus,
  ) =>
    openItemReview(
      documentLabels[document.type] || document.type,
      status,
      document.reviewNote,
      (note) =>
        runAction(
          () => actions.updateDocumentReview(document.id, status, note),
          "Đã cập nhật kết quả tài liệu.",
        ),
    );

  const openDecision = (type: "approve" | "changes" | "reject") => {
    if (type === "approve") {
      setPendingDialog({
        title: "Phê duyệt hồ sơ đối tác",
        description:
          "Hệ thống sẽ cấp quyền đối tác, tạo hồ sơ nhà cung cấp, ví và các dịch vụ đã xác minh.",
        confirmLabel: "Phê duyệt hồ sơ",
        tone: "success",
        noteRequired: false,
        submit: () =>
          runAction(actions.approveApplication, "Hồ sơ đã được phê duyệt thành công."),
      });
      return;
    }

    const requestingChanges = type === "changes";
    setPendingDialog({
      title: requestingChanges ? "Yêu cầu bổ sung hồ sơ" : "Từ chối hồ sơ",
      description: requestingChanges
        ? "Đối tác sẽ nhận được nội dung này và có thể cập nhật hồ sơ để gửi lại."
        : "Quyết định từ chối sẽ kết thúc lần đăng ký hiện tại.",
      confirmLabel: requestingChanges ? "Gửi yêu cầu" : "Từ chối hồ sơ",
      tone: requestingChanges ? "warning" : "danger",
      noteRequired: true,
      submit: (note) =>
        runAction(
          () =>
            requestingChanges ? actions.requestChanges(note) : actions.rejectApplication(note),
          requestingChanges
            ? "Đã gửi yêu cầu bổ sung cho đối tác."
            : "Hồ sơ đã bị từ chối.",
        ),
    });
  };

  const openBulkReview = () => {
    setPendingDialog({
      title: "Duyệt tất cả mục hợp lệ",
      description:
        "Hệ thống sẽ xác minh các tài liệu đang chờ, các dịch vụ đáp ứng đủ điều kiện và các hạng mục có thể hoàn tất. Mục cần bổ sung, bị từ chối hoặc đề xuất dịch vụ sẽ được giữ nguyên.",
      confirmLabel: "Duyệt các mục hợp lệ",
      tone: "success",
      noteRequired: false,
      submit: () =>
        runAction(actions.reviewAllEligible, (result) => {
          const verified =
            result.verifiedDocuments +
            result.verifiedServices +
            result.verifiedChecks;
          const skipped = result.skippedServices.length;
          return skipped > 0
            ? `Đã xác minh ${verified} mục; ${skipped} dịch vụ chưa đủ điều kiện và được giữ lại để xử lý.`
            : `Đã xác minh ${verified} mục hợp lệ.`;
        }).then(() => undefined),
    });
  };

  return {
    state: {
      pendingDialog,
      documentPreview,
      actionError,
      successMessage,
    },
    setters: {
      setPendingDialog,
      setDocumentPreview,
      setActionError,
      setSuccessMessage,
    },
    handlers: {
      runAction,
      openItemReview,
      openDocument,
      reviewDocument,
      openDecision,
      openBulkReview,
    },
  };
}

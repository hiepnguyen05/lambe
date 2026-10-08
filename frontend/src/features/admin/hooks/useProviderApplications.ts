import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../../lib/api-client";
import { useAdminAuth } from "./useAdminAuth";

export type ProviderApplicationStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "NEEDS_CHANGES"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";

export type ReviewStatus =
  "PENDING" | "VERIFIED" | "NEEDS_CHANGES" | "REJECTED";

export type ProviderApplicationSection =
  "IDENTITY" | "PORTRAIT" | "EXPERTISE" | "SERVICES" | "TERMS";

interface ReviewerSummary {
  id: string;
  username: string;
  fullName: string | null;
}

interface UserSummary {
  id: string;
  phone: string | null;
  fullName: string | null;
  status?: string;
}

export interface ProviderApplicationListItem {
  id: string;
  providerType: "INDIVIDUAL" | "ORGANIZATION";
  status: ProviderApplicationStatus;
  legalFullName: string | null;
  organizationName: string | null;
  revisionNumber: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: UserSummary;
  _count: {
    documents: number;
    services: number;
    serviceSuggestions: number;
  };
}

export interface ProviderReviewCheck {
  id: string;
  section: ProviderApplicationSection;
  status: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedBy?: ReviewerSummary | null;
}

export interface ProviderDocument {
  id: string;
  applicationServiceId: string | null;
  type: string;
  deliveryType?: string;
  fileFormat?: string | null;
  isPublicCandidate: boolean;
  status: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reviewedBy?: ReviewerSummary | null;
}

export interface ProviderDocumentAccess {
  documentId?: string;
  url: string;
  fileFormat: string | null;
}

interface ServiceSummary {
  id: string;
  code: string;
  name: string;
  minPriceAmount: number;
  maxPriceAmount: number;
  currencyCode: string;
  targetAudience: string;
  requiresCertificate: boolean;
  minPortfolioImages: number;
  minExperienceYears: number;
  category: { id: string; name: string; slug: string };
}

export interface ProviderApplicationService {
  id: string;
  serviceId: string;
  proposedPriceAmount: number;
  durationMinutes: number | null;
  description: string | null;
  status: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  service: ServiceSummary;
  reviewedBy?: ReviewerSummary | null;
}

export interface ProviderServiceSuggestion {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  proposedPriceAmount: number;
  durationMinutes: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  approvedServiceId: string | null;
  category?: { id: string; name: string };
  reviewedBy?: ReviewerSummary | null;
}

export interface ProviderApplicationDetail {
  id: string;
  providerType: "INDIVIDUAL" | "ORGANIZATION";
  status: ProviderApplicationStatus;
  revisionNumber: number;
  legalFullName: string | null;
  organizationName: string | null;
  birthDate: string | null;
  gender: string | null;
  email: string | null;
  biography: string | null;
  nationalIdNumber?: string | null;
  nationalIdMasked?: string | null;
  experienceYears: number | null;
  taxCode: string | null;
  businessRegistrationNumber: string | null;
  registeredAddress: string | null;
  representativeName: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
  user: UserSummary;
  checks?: ProviderReviewCheck[];
  documents?: ProviderDocument[];
  services: ProviderApplicationService[];
  serviceSuggestions?: ProviderServiceSuggestion[];
  termsAcceptances?: {
    id: string;
    termsVersion: string;
    acceptedAt: string;
  }[];
  reviewedBy?: ReviewerSummary | null;
}

export interface ApproveServiceSuggestionInput {
  categoryId: string;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  iconUrl?: string | null;
  minPriceAmount: number;
  maxPriceAmount: number;
  defaultDurationMinutes?: number | null;
  targetAudience?: "ALL" | "MEN" | "WOMEN";
  sortOrder?: number;
  requiresCertificate?: boolean;
  minPortfolioImages?: number;
  minExperienceYears?: number;
}

export interface BulkReviewResult {
  verifiedDocuments: number;
  verifiedServices: number;
  verifiedChecks: number;
  skippedServices: Array<{ id: string; name: string; reason: string }>;
  pendingSuggestions: number;
}

interface ApprovedServiceSuggestionResult {
  service: { id: string };
  applicationService: { id: string; status: ReviewStatus };
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function useProviderApplications() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING_REVIEW");
  const [typeFilter, setTypeFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 10 });
  const { token } = useAdminAuth();

  const queryKey = [
    "provider-applications",
    { page: pagination.page, limit: pagination.limit, searchQuery, statusFilter, typeFilter }
  ];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter && typeFilter !== "all") params.set("providerType", typeFilter);

      return apiRequest<
        ApiEnvelope<ProviderApplicationListItem[]> & { meta: { total: number; totalPages: number } }
      >(`/admin/provider-applications?${params.toString()}`, {
        headers: authHeaders(token!),
      });
    },
    enabled: !!token,
  });

  return {
    applications: data?.data ?? [],
    totalCount: data?.meta?.total ?? 0,
    totalPages: data?.meta?.totalPages ?? 0,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    pagination,
    setPagination,
    isLoading,
    error: error ? errorMessage(error, "Không thể tải danh sách hồ sơ đối tác.") : null,
    refetch,
  };
}

export function usePendingProviderApplicationCount() {
  const { token } = useAdminAuth();

  const { data } = useQuery({
    queryKey: ["pending-provider-applications-count"],
    queryFn: async () => {
      return apiRequest<
        ApiEnvelope<ProviderApplicationListItem[]> & { meta: { total: number } }
      >("/admin/provider-applications?status=PENDING_REVIEW&page=1&limit=1", {
        headers: authHeaders(token!),
      });
    },
    enabled: !!token,
    refetchInterval: 30000, // optionally poll every 30s
  });

  return data?.meta?.total ?? 0;
}

export function useProviderDocumentPreviews(
  applicationId: string | undefined,
  enabled: boolean,
) {
  const { token } = useAdminAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["provider-document-previews", applicationId],
    queryFn: async () => {
      const response = await apiRequest<ApiEnvelope<ProviderDocumentAccess[]>>(
        `/admin/provider-applications/${applicationId}/documents/access`,
        { headers: authHeaders(token!) },
      );
      return Object.fromEntries(
        (response.data ?? [])
          .filter((item) => item.documentId)
          .map((item) => [item.documentId as string, item]),
      );
    },
    enabled: !!token && !!applicationId && enabled,
  });

  return {
    accesses: data ?? {},
    isLoading,
    error: error ? errorMessage(error, "Không thể tải ảnh tài liệu KYC.") : null,
    refetch,
  };
}

export function useProviderApplicationDetail(id?: string) {
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const { token } = useAdminAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["provider-application-detail", id],
    queryFn: async () => {
      const response = await apiRequest<ApiEnvelope<ProviderApplicationDetail>>(
        `/admin/provider-applications/${id}`,
        { headers: authHeaders(token!) },
      );
      return response.data;
    },
    enabled: !!token && !!id,
  });

  const application = data ?? null;

  const mutateAndRefresh = useCallback(
    async <T>(
      actionKey: string,
      path: string,
      options: RequestInit,
    ): Promise<T> => {
      if (!token || !id) throw new Error("Phiên đăng nhập không hợp lệ.");
      setActiveAction(actionKey);
      try {
        const response = await apiRequest<ApiEnvelope<T>>(path, {
          ...options,
          headers: authHeaders(token),
        });
        await refetch();
        return response.data;
      } catch (requestError) {
        throw new Error(
          errorMessage(requestError, "Không thể cập nhật hồ sơ."),
        );
      } finally {
        setActiveAction(null);
      }
    },
    [refetch, id, token],
  );

  const updateSectionCheck = (
    section: ProviderApplicationSection,
    status: Exclude<ReviewStatus, "PENDING">,
    reviewNote?: string,
  ) =>
    mutateAndRefresh<void>(
      `check:${section}`,
      `/admin/provider-applications/${id}/checks/${section}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
          reviewNote: reviewNote?.trim() || null,
        }),
      },
    );

  const updateDocumentReview = (
    documentId: string,
    status: Exclude<ReviewStatus, "PENDING">,
    reviewNote?: string,
  ) =>
    mutateAndRefresh<void>(
      `document:${documentId}`,
      `/admin/provider-applications/${id}/documents/${documentId}/review`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
          reviewNote: reviewNote?.trim() || null,
        }),
      },
    );

  const updateServiceReview = (
    serviceItemId: string,
    status: Exclude<ReviewStatus, "PENDING">,
    reviewNote?: string,
  ) =>
    mutateAndRefresh<void>(
      `service:${serviceItemId}`,
      `/admin/provider-applications/${id}/services/${serviceItemId}/review`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
          reviewNote: reviewNote?.trim() || null,
        }),
      },
    );

  const accessDocument = async (documentId: string) => {
    if (!token || !id) throw new Error("Phiên đăng nhập không hợp lệ.");
    setActiveAction(`access:${documentId}`);
    try {
      const response = await apiRequest<ApiEnvelope<ProviderDocumentAccess>>(
        `/admin/provider-applications/${id}/documents/${documentId}/access`,
        { headers: authHeaders(token) },
      );
      return response.data;
    } catch (requestError) {
      throw new Error(
        errorMessage(requestError, "Không thể mở tài liệu bảo mật."),
      );
    } finally {
      setActiveAction(null);
    }
  };

  const approveServiceSuggestion = (
    suggestionId: string,
    input: ApproveServiceSuggestionInput,
  ) =>
    mutateAndRefresh<ApprovedServiceSuggestionResult>(
      `suggestion:${suggestionId}`,
      `/admin/provider-applications/${id}/service-suggestions/${suggestionId}/approve`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );

  const uploadServiceCoverImage = async (serviceId: string, file: File) => {
    if (!token) throw new Error("Phiên đăng nhập không hợp lệ.");
    const formData = new FormData();
    formData.append("file", file);
    await apiRequest(`/admin/services/${serviceId}/cover-image`, {
      method: "POST",
      headers: authHeaders(token),
      body: formData,
    });
  };

  const reviewAllEligible = () =>
    mutateAndRefresh<BulkReviewResult>(
      "review-all",
      `/admin/provider-applications/${id}/review-all-eligible`,
      { method: "POST" },
    );

  const rejectServiceSuggestion = (suggestionId: string, reason: string) =>
    mutateAndRefresh<void>(
      `suggestion:${suggestionId}`,
      `/admin/provider-applications/${id}/service-suggestions/${suggestionId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      },
    );

  const approveApplication = () =>
    mutateAndRefresh<void>(
      "decision",
      `/admin/provider-applications/${id}/approve`,
      {
        method: "POST",
      },
    );

  const requestChanges = (reason: string) =>
    mutateAndRefresh<void>(
      "decision",
      `/admin/provider-applications/${id}/request-changes`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      },
    );

  const rejectApplication = (reason: string) =>
    mutateAndRefresh<void>(
      "decision",
      `/admin/provider-applications/${id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      },
    );

  return {
    application,
    isLoading,
    activeAction,
    error: error ? errorMessage(error, "Không thể tải chi tiết hồ sơ.") : null,
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
  };
}

import type { ProviderApplicationSection } from '../../../hooks/useProviderApplications';

export const sectionLabels: Record<ProviderApplicationSection, string> = {
  IDENTITY: 'Thông tin định danh',
  PORTRAIT: 'Ảnh chân dung',
  EXPERTISE: 'Kinh nghiệm & chứng chỉ',
  SERVICES: 'Dịch vụ & mức giá',
  TERMS: 'Điều khoản đối tác',
};

export const documentLabels: Record<string, string> = {
  PORTRAIT: 'Ảnh chân dung',
  ID_CARD_FRONT: 'CCCD mặt trước',
  ID_CARD_BACK: 'CCCD mặt sau',
  IDENTITY_SELFIE: 'Ảnh xác minh danh tính',
  PROFESSIONAL_CERTIFICATE: 'Chứng chỉ chuyên môn',
  BUSINESS_LICENSE: 'Giấy phép kinh doanh',
  PORTFOLIO: 'Hồ sơ năng lực',
  OTHER: 'Tài liệu khác',
};

export function formatDate(value?: string | null, includeTime = false) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

export function formatMoney(value?: number | null, currency = 'VND') {
  if (value == null) return 'Chưa có giá';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export const documentStatusOrder: import('../../../hooks/useProviderApplications').ReviewStatus[] = [
  "PENDING",
  "VERIFIED",
  "NEEDS_CHANGES",
  "REJECTED",
];

export function getDocumentStatusCounts(documents: import('../../../hooks/useProviderApplications').ProviderDocument[]) {
  return documentStatusOrder
    .map((status) => ({
      status,
      count: documents.filter((document) => document.status === status).length,
    }))
    .filter(({ count }) => count > 0);
}

export function getLatestDocumentDate(documents: import('../../../hooks/useProviderApplications').ProviderDocument[]) {
  return documents.reduce(
    (latest, document) =>
      new Date(document.createdAt).getTime() > new Date(latest).getTime()
        ? document.createdAt
        : latest,
    documents[0].createdAt,
  );
}

export function getServiceVerificationIssue(
  item: import('../../../hooks/useProviderApplications').ProviderApplicationService,
  documents: import('../../../hooks/useProviderApplications').ProviderDocument[],
  experienceYears: number | null,
): string | null {
  if (
    item.proposedPriceAmount < item.service.minPriceAmount ||
    item.proposedPriceAmount > item.service.maxPriceAmount
  ) {
    return "Giá đăng ký nằm ngoài giá sàn/trần của dịch vụ.";
  }
  if ((experienceYears ?? 0) < item.service.minExperienceYears) {
    return `Yêu cầu tối thiểu ${item.service.minExperienceYears} năm kinh nghiệm.`;
  }

  const evidence = documents.filter(
    (document) =>
      document.status === "VERIFIED" &&
      (document.applicationServiceId === null ||
        document.applicationServiceId === item.id),
  );
  if (
    item.service.requiresCertificate &&
    !evidence.some((document) => document.type === "PROFESSIONAL_CERTIFICATE")
  ) {
    return "Chưa có chứng chỉ chuyên môn đã xác minh.";
  }

  const portfolioCount = evidence.filter(
    (document) => document.type === "PORTFOLIO",
  ).length;
  if (portfolioCount < item.service.minPortfolioImages) {
    return `Cần ${item.service.minPortfolioImages} ảnh portfolio đã xác minh, hiện có ${portfolioCount}.`;
  }
  return null;
}

export function genderLabel(value?: string | null) {
  if (value === "MALE") return "Nam";
  if (value === "FEMALE") return "Nữ";
  if (value === "OTHER") return "Khác";
  return "Chưa cập nhật";
}

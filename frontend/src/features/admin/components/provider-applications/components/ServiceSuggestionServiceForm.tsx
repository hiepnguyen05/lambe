import { useMemo } from "react";
import type {
  ApproveServiceSuggestionInput,
  ProviderDocument,
  ProviderServiceSuggestion,
} from "../../../hooks/useProviderApplications";
import {
  ServiceFormModal,
  type ServiceFormPayload,
  type ServiceFormValues,
} from "../../services/ServiceFormModal";

interface ServiceSuggestionServiceFormProps {
  suggestion: ProviderServiceSuggestion | null;
  isSubmitting: boolean;
  experienceYears: number | null;
  documents: ProviderDocument[];
  onClose: () => void;
  onSubmit: (input: ApproveServiceSuggestionInput) => Promise<{ id: string }>;
  uploadCoverImage: (serviceId: string, file: File) => Promise<unknown>;
}

function serviceIdentifier(value: string, separator: "-" | "_"): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, separator)
    .slice(0, separator === "_" ? 50 : 120);
}

export function ServiceSuggestionServiceForm({
  suggestion,
  isSubmitting,
  experienceYears,
  documents,
  onClose,
  onSubmit,
  uploadCoverImage,
}: ServiceSuggestionServiceFormProps) {
  const initialValues = useMemo<Partial<ServiceFormValues> | undefined>(() => {
    if (!suggestion) return undefined;
    return {
      categoryId: suggestion.categoryId,
      name: suggestion.name,
      code: serviceIdentifier(suggestion.name, "_").toUpperCase(),
      slug: serviceIdentifier(suggestion.name, "-").toLowerCase(),
      description: suggestion.description ?? "",
      minPriceAmount: suggestion.proposedPriceAmount,
      maxPriceAmount: suggestion.proposedPriceAmount,
      defaultDurationMinutes: suggestion.durationMinutes ?? 45,
    };
  }, [suggestion]);

  return (
    <ServiceFormModal
      isOpen={Boolean(suggestion)}
      onClose={onClose}
      onSuccess={onClose}
      initialValues={initialValues}
      title="Tạo dịch vụ từ đề xuất"
      submitLabel={
        isSubmitting ? "Đang tạo và xác minh..." : "Tạo và xác minh dịch vụ"
      }
      contextNote={
        suggestion
          ? `Thông tin được điền từ đề xuất “${suggestion.name}”. Quản trị có thể chỉnh sửa trước khi tạo; khi thành công, dịch vụ trong hồ sơ sẽ được xác minh ngay.`
          : undefined
      }
      validateBeforeSubmit={(values) => {
        const availableDocuments = documents.filter(
          (document) => document.status !== "REJECTED",
        );
        if (values.minExperienceYears > (experienceYears ?? 0)) {
          return `Hồ sơ có ${experienceYears ?? 0} năm kinh nghiệm, thấp hơn yêu cầu ${values.minExperienceYears} năm của dịch vụ.`;
        }
        if (
          values.requiresCertificate &&
          !availableDocuments.some(
            (document) => document.type === "PROFESSIONAL_CERTIFICATE",
          )
        ) {
          return "Dịch vụ yêu cầu chứng chỉ nghề nhưng hồ sơ chưa tải chứng chỉ hợp lệ.";
        }
        const portfolioCount = availableDocuments.filter(
          (document) => document.type === "PORTFOLIO",
        ).length;
        if (values.minPortfolioImages > portfolioCount) {
          return `Dịch vụ yêu cầu ${values.minPortfolioImages} ảnh portfolio nhưng hồ sơ hiện có ${portfolioCount} ảnh hợp lệ.`;
        }
        return null;
      }}
      createService={(values: ServiceFormPayload) => onSubmit(values)}
      uploadCoverImage={uploadCoverImage}
    />
  );
}

/* eslint-disable react/set-state-in-effect -- Opening a record intentionally resets the modal draft. */
import { useState, useEffect, useRef } from "react";
import {
  X,
  Save,
  Upload,
  Trash2,
  Image as ImageIcon,
  ChevronDown,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { AdminService } from "../../hooks/useAdminServices";
import { useAdminCategories } from "../../hooks/useAdminCategories";
import {
  commonCatalogIcons,
  generateCatalogCode,
  generateCatalogSlug,
  parseIconValue,
  buildIconValue,
} from "../../utils/catalog-form";
import { LambeIcon } from "../../../../components/ui/LambeIcon";
import { uploadAdminImage } from "../../utils/admin-upload";

export interface ServiceFormValues {
  categoryId: string;
  name: string;
  code: string;
  slug: string;
  description: string;
  iconUrl: string;
  minPriceAmount: number;
  maxPriceAmount: number;
  defaultDurationMinutes: number;
  targetAudience: "ALL" | "MEN" | "WOMEN";
  sortOrder: number;
  requiresCertificate: boolean;
  minPortfolioImages: number;
  minExperienceYears: number;
}

export interface ServiceFormPayload extends Omit<
  ServiceFormValues,
  "description" | "iconUrl"
> {
  description: string | null;
  iconUrl: string | null;
}

interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: AdminService;
  initialValues?: Partial<ServiceFormValues>;
  nextSortOrder?: number;
  title?: string;
  submitLabel?: string;
  contextNote?: string;
  validateBeforeSubmit?: (data: ServiceFormPayload) => string | null;
  createService: (data: ServiceFormPayload) => Promise<{ id: string }>;
  updateService?: (
    id: string,
    data: Omit<ServiceFormPayload, "code">,
  ) => Promise<unknown>;
  uploadCoverImage?: (id: string, file: File) => Promise<unknown>;
  removeCoverImage?: (id: string) => Promise<unknown>;
}

export function ServiceFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  initialValues,
  nextSortOrder = 1,
  title,
  submitLabel,
  contextNote,
  validateBeforeSubmit,
  createService,
  updateService,
  uploadCoverImage,
  removeCoverImage,
}: ServiceFormModalProps) {
  const isEditing = !!initialData;
  const { categories } = useAdminCategories();

  const [formData, setFormData] = useState<ServiceFormValues>({
    categoryId: "",
    name: "",
    code: "",
    slug: "",
    description: "",
    iconUrl: "",
    minPriceAmount: 50000,
    maxPriceAmount: 500000,
    defaultDurationMinutes: 45,
    targetAudience: "ALL",
    sortOrder: 0,
    requiresCertificate: false,
    minPortfolioImages: 0,
    minExperienceYears: 0,
  });

  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(
    null,
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [iconCode, setIconCode] = useState("scissors");
  const [iconImageUrl, setIconImageUrl] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [uploadIconError, setUploadIconError] = useState<string | null>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const formContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        iconPickerRef.current &&
        !iconPickerRef.current.contains(event.target as Node)
      ) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Setup initial data
  useEffect(() => {
    if (isOpen) {
      const rawIcon = initialData?.iconUrl ?? initialValues?.iconUrl;
      const parsedIcon = parseIconValue(rawIcon);
      setIconCode(parsedIcon.iconCode || "scissors");
      setIconImageUrl(parsedIcon.iconImageUrl);
      setIconSearch(parsedIcon.iconCode || "scissors");

      if (initialData) {
        // The modal intentionally resets its draft when a different service is opened.
        // eslint-disable-next-line react/set-state-in-effect
        setFormData({
          categoryId: initialData.categoryId || "",
          name: initialData.name || "",
          code: initialData.code || "",
          slug: initialData.slug || "",
          description: initialData.description || "",
          iconUrl: initialData.iconUrl || "",
          minPriceAmount: initialData.minPriceAmount || 0,
          maxPriceAmount: initialData.maxPriceAmount || 0,
          defaultDurationMinutes: initialData.defaultDurationMinutes || 45,
          targetAudience: initialData.targetAudience || "ALL",
          sortOrder: initialData.sortOrder || 0,
          requiresCertificate: initialData.requiresCertificate || false,
          minPortfolioImages: initialData.minPortfolioImages || 0,
          minExperienceYears: initialData.minExperienceYears || 0,
        });
        setCoverImagePreview(initialData.coverImageUrl || null);
      } else {
        setFormData({
          categoryId: initialValues?.categoryId ?? (categories[0]?.id || ""),
          name: "",
          code: "",
          slug: "",
          description: "",
          iconUrl: "",
          minPriceAmount: 50000,
          maxPriceAmount: 500000,
          defaultDurationMinutes: 45,
          targetAudience: "ALL",
          sortOrder: nextSortOrder,
          requiresCertificate: false,
          minPortfolioImages: 0,
          minExperienceYears: 0,
          ...initialValues,
        });
        setCoverImagePreview(null);
      }
      setCoverImage(null);
      setError("");
      setShowIconPicker(false);
      setIsUploadingIcon(false);
      setUploadIconError(null);
    }
  }, [isOpen, initialData, initialValues, categories, nextSortOrder]);

  // Auto-generate slug & code
  const handleNameChange = (val: string) => {
    if (isEditing) {
      setFormData((prev) => ({ ...prev, name: val }));
      return;
    }

    const name = val;
    const slug = generateCatalogSlug(name);
    const code = generateCatalogCode(name);

    setFormData((prev) => ({ ...prev, name, slug, code }));
  };

  useEffect(() => {
    return () => {
      if (coverImagePreview && coverImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(coverImagePreview);
      }
    };
  }, [coverImagePreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (coverImagePreview && coverImagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(coverImagePreview);
      }
      setCoverImage(file);
      setCoverImagePreview(URL.createObjectURL(file));
    }
  };

  const handleDeleteImage = async () => {
    if (coverImagePreview && coverImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(coverImagePreview);
    }
    if (
      isEditing &&
      initialData?.coverImageUrl &&
      !coverImage &&
      removeCoverImage
    ) {
      try {
        setIsSubmitting(true);
        await removeCoverImage(initialData.id);
        setCoverImagePreview(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Lỗi khi xóa ảnh");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCoverImage(null);
      setCoverImagePreview(initialData?.coverImageUrl || null);
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setIsUploadingIcon(true);
    setUploadIconError(null);
    try {
      const uploaded = await uploadAdminImage(file, 'services');
      setIconImageUrl(uploaded.secureUrl);
      setShowIconPicker(false);
    } catch (err: unknown) {
      setUploadIconError(err instanceof Error ? err.message : 'Lỗi khi tải ảnh icon lên.');
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const filteredIcons = commonCatalogIcons.filter(
    (icon) =>
      icon.name.toLowerCase().includes(iconSearch.toLowerCase()) ||
      icon.label.toLowerCase().includes(iconSearch.toLowerCase()),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // Validate
      if (!formData.categoryId) throw new Error("Vui lòng chọn danh mục.");
      if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(formData.code.trim()))
        throw new Error(
          "Mã dịch vụ phải bắt đầu bằng chữ, chỉ gồm chữ in hoa, số và dấu gạch dưới.",
        );
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug.trim()))
        throw new Error(
          "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang.",
        );
      if (formData.minPriceAmount > formData.maxPriceAmount)
        throw new Error("Giá sàn không được lớn hơn giá trần.");
      if (
        formData.defaultDurationMinutes < 15 ||
        formData.defaultDurationMinutes > 720
      )
        throw new Error("Thời gian thực hiện phải từ 15 đến 720 phút.");

      const finalIconUrl = buildIconValue(iconCode, iconImageUrl);
      const payload: ServiceFormPayload = {
        ...formData,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        slug: formData.slug.trim().toLowerCase(),
        description: formData.description.trim() || null,
        iconUrl: finalIconUrl ? finalIconUrl.trim() : null,
      };
      const validationError = validateBeforeSubmit?.(payload);
      if (validationError) throw new Error(validationError);

      let serviceId = "";

      if (isEditing && initialData) {
        if (!updateService) throw new Error("Thiếu hàm cập nhật dịch vụ.");
        // Cập nhật - API PATCH không cho phép update `code`
        const { code: _code, ...updateData } = payload;
        await updateService(initialData.id, updateData);
        serviceId = initialData.id;
      } else {
        // Tạo mới
        const res = await createService(payload);
        serviceId = res.id;
      }

      // Upload ảnh nếu có
      if (coverImage && serviceId && uploadCoverImage) {
        await uploadCoverImage(serviceId, coverImage);
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra khi lưu dịch vụ.");
      requestAnimationFrame(() => {
        formContentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {title ?? (isEditing ? "Cập nhật dịch vụ" : "Thêm dịch vụ mới")}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={formContentRef}
          className="flex-1 overflow-y-auto p-5 custom-scrollbar"
        >
          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-sm font-medium flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          {contextNote && (
            <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-900">
              {contextNote}
            </div>
          )}

          <form id="serviceForm" onSubmit={handleSubmit} className="space-y-8">
            {/* Section: Thông tin chung */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-[#0f766e]">
                  info
                </span>
                Thông tin chung
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Tên dịch vụ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="VD: Cắt tóc nam, Gội đầu dưỡng sinh..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Mã dịch vụ (Code) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="VD: MEN_HAIRCUT"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {!isEditing && (
                    <p className="text-[11px] text-slate-500">
                      Mã định danh duy nhất (Viết hoa, không dấu, nối bằng `_`).
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Đường dẫn (Slug) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                    placeholder="VD: cat-toc-nam"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Danh mục <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData({ ...formData, categoryId: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition cursor-pointer"
                  >
                    <option value="" disabled>
                      Chọn danh mục...
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className="space-y-3 relative p-4 rounded-xl bg-slate-50 border border-slate-200 md:col-span-2"
                  ref={iconPickerRef}
                >
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-800">
                      Cấu hình Icon dịch vụ
                    </label>
                    {iconImageUrl && (
                      <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        Đang dùng ảnh tùy chỉnh
                      </span>
                    )}
                  </div>

                  {/* 1. Mã Icon Vector dự phòng */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 block">
                      1. Mã Icon Vector dự phòng <span className="text-slate-400 font-normal">(dùng khi chưa có ảnh hoặc khi ảnh lỗi mạng)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LambeIcon nameOrUrl={iconCode} className="w-5 h-5 text-[#0f766e]" />
                      </div>
                      <input
                        type="text"
                        value={iconCode}
                        onChange={(e) => {
                          setIconCode(e.target.value);
                          setIconSearch(e.target.value);
                          setShowIconPicker(true);
                        }}
                        onFocus={() => setShowIconPicker(true)}
                        placeholder="Chọn mã icon (VD: scissors, flame, flower-2)..."
                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowIconPicker(!showIconPicker)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${showIconPicker ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>

                    {/* Popup cho phép chọn Icon */}
                    {showIconPicker && (
                      <div className="absolute z-20 w-full mt-1 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="p-3 max-h-56 overflow-y-auto grid grid-cols-4 md:grid-cols-5 gap-2 custom-scrollbar">
                          {filteredIcons.length > 0 ? (
                            filteredIcons.map((icon) => (
                              <button
                                key={icon.name}
                                type="button"
                                onClick={() => {
                                  setIconCode(icon.name);
                                  setIconSearch(icon.name);
                                  setShowIconPicker(false);
                                }}
                                className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all ${
                                  iconCode === icon.name
                                    ? "bg-teal-50 border border-[#0f766e] text-[#0f766e]"
                                    : "bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 hover:border-slate-300"
                                }`}
                                title={icon.label}
                              >
                                <LambeIcon nameOrUrl={icon.name} className="w-5 h-5 mb-1" />
                                <span className="text-[10px] text-center line-clamp-1 opacity-70 font-medium w-full">
                                  {icon.label}
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="col-span-full py-3 text-center text-xs text-slate-500">
                              Sử dụng icon tùy chỉnh: <strong>{iconSearch}</strong>
                            </div>
                          )}
                        </div>
                        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Chuẩn Vector Lucide</span>
                          <a
                            href="https://lucide.dev/icons"
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#0f766e] hover:underline font-semibold"
                          >
                            Tra cứu mã icon
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Ảnh Icon Tùy chỉnh (Ưu tiên hiển thị) */}
                  <div className="space-y-1.5 pt-2.5 border-t border-slate-200/80">
                    <label className="text-xs font-semibold text-slate-600 block">
                      2. Ảnh Icon tùy chỉnh <span className="text-slate-400 font-normal">(ưu tiên hiển thị cao nhất nếu có)</span>
                    </label>

                    {iconImageUrl ? (
                      <div className="flex items-center justify-between p-2.5 bg-white border border-teal-200 rounded-xl shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-teal-200 bg-slate-50 flex-shrink-0 flex items-center justify-center shadow-2xs">
                            <img
                              src={iconImageUrl}
                              alt="Icon preview"
                              className="w-full h-full object-cover block"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">Ảnh icon đang dùng</p>
                            <p className="text-[11px] text-teal-600">
                              Fallback dự phòng: <span className="font-semibold">{iconCode}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label
                            className={`cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-[#0f766e] bg-slate-50 hover:bg-teal-50 border border-slate-200 rounded-lg transition ${
                              isUploadingIcon ? "opacity-50 pointer-events-none" : ""
                            }`}
                          >
                            {isUploadingIcon ? "Đang đổi..." : "Đổi ảnh"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/svg+xml"
                              className="hidden"
                              disabled={isUploadingIcon}
                              onChange={handleIconUpload}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setIconImageUrl("")}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Gỡ ảnh icon, dùng lại icon vector"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label
                          className={`cursor-pointer w-full py-2.5 px-3 border border-dashed border-slate-300 hover:border-[#0f766e] hover:bg-teal-50/40 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#0f766e] transition ${
                            isUploadingIcon ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {isUploadingIcon ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#0f766e]" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span>{isUploadingIcon ? "Đang tải ảnh..." : "Tải lên ảnh icon (JPG, PNG, WebP, SVG)"}</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                            className="hidden"
                            disabled={isUploadingIcon}
                            onChange={handleIconUpload}
                          />
                        </label>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Hệ thống lưu trữ ảnh và tự động kích hoạt mã icon vector dự phòng nếu gặp sự cố kết nối hoặc lỗi ảnh.
                        </p>
                      </div>
                    )}

                    {uploadIconError && (
                      <p className="text-xs text-rose-500 font-medium">
                        {uploadIconError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Mô tả dịch vụ
                  </label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Nhập mô tả chi tiết về dịch vụ..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition resize-none custom-scrollbar"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-semibold text-slate-700 flex justify-between items-center">
                    Ảnh bìa dịch vụ
                    {coverImagePreview && (
                      <button
                        type="button"
                        onClick={handleDeleteImage}
                        className="text-xs text-rose-600 font-semibold hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Xóa ảnh
                      </button>
                    )}
                  </label>

                  <div className="flex gap-4 items-start">
                    {coverImagePreview ? (
                      <div className="w-32 h-32 rounded-xl border-2 border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0 relative group">
                        <img
                          src={coverImagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white">
                          <Upload className="w-6 h-6" />
                          <input
                            type="file"
                            accept="image/jpeg, image/png, image/webp"
                            className="hidden"
                            onChange={handleImageChange}
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0f766e] hover:bg-teal-50 transition flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-[#0f766e] flex-shrink-0 bg-slate-50">
                        <ImageIcon className="w-8 h-8 mb-2" />
                        <span className="text-xs font-semibold">
                          Tải ảnh lên
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg, image/png, image/webp"
                          className="hidden"
                          onChange={handleImageChange}
                        />
                      </label>
                    )}
                    <div className="text-xs text-slate-500 pt-2 space-y-1">
                      <p>Khuyên dùng ảnh tỷ lệ 4:3 hoặc 16:9.</p>
                      <p>Định dạng: JPEG, PNG, WEBP. Tối đa 5MB.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Khung giá và Thời lượng */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="material-symbols-outlined text-[#0f766e]">
                  payments
                </span>
                Cấu hình dịch vụ
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Giá sàn (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.minPriceAmount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minPriceAmount: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Giá trần (VNĐ) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.maxPriceAmount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        maxPriceAmount: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Thời gian thực hiện (Phút)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={720}
                    value={formData.defaultDurationMinutes}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        defaultDurationMinutes: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Đối tượng phục vụ
                  </label>
                  <select
                    value={formData.targetAudience}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        targetAudience: e.target.value as ServiceFormValues['targetAudience'],
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition cursor-pointer"
                  >
                    <option value="ALL">Mọi đối tượng</option>
                    <option value="MEN">Nam</option>
                    <option value="WOMEN">Nữ</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Thứ tự hiển thị
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sortOrder: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition"
                  />
                </div>
              </div>
            </div>

            {/* Section: Yêu cầu đối tác */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0f766e]">
                  verified_user
                </span>
                Yêu cầu duyệt năng lực Thợ (Đối tác)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresCertificate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requiresCertificate: e.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded border-slate-300 text-[#0f766e] focus:ring-[#0f766e] transition"
                    />
                    <div>
                      <div className="font-semibold text-sm text-slate-800">
                        Bắt buộc tải lên Chứng chỉ nghề / Bằng cấp
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Yêu cầu đối tác phải cung cấp chứng chỉ hành nghề hợp lệ
                        để đăng ký dịch vụ này.
                      </div>
                    </div>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Kinh nghiệm tối thiểu (Năm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={formData.minExperienceYears}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minExperienceYears: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Số ảnh Portfolio (Hình chụp mẫu) tối thiểu
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={formData.minPortfolioImages}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minPortfolioImages: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition"
                  />
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-2xs cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            form="serviceForm"
            disabled={isSubmitting}
            className="px-6 py-2.5 text-sm font-bold text-white bg-[#0f766e] hover:bg-teal-800 rounded-xl transition shadow-sm shadow-teal-600/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {submitLabel ??
                  (isEditing ? "Cập nhật dịch vụ" : "Tạo dịch vụ")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

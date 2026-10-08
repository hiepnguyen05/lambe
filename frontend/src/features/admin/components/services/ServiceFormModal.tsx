import { useState, useEffect, useRef } from "react";
import {
  X,
  Save,
  Upload,
  Trash2,
  Image as ImageIcon,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import type { AdminService } from "../../hooks/useAdminServices";
import { useAdminCategories } from "../../hooks/useAdminCategories";

const COMMON_ICONS = [
  { name: "content_cut", label: "Cắt tóc" },
  { name: "spa", label: "Spa & Massage" },
  { name: "face", label: "Chăm sóc da" },
  { name: "face_retouching_natural", label: "Trang điểm" },
  { name: "brush", label: "Làm móng / Cọ" },
  { name: "palette", label: "Nhuộm / Màu" },
  { name: "wash", label: "Gội đầu" },
  { name: "healing", label: "Trị liệu" },
  { name: "local_florist", label: "Thảo mộc" },
  { name: "clean_hands", label: "Vệ sinh" },
  { name: "health_and_safety", label: "Phòng khám" },
  { name: "self_improvement", label: "Thư giãn" },
  { name: "favorite", label: "Yêu thích" },
  { name: "star", label: "Nổi bật" },
  { name: "category", label: "Mặc định" },
];

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

  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
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
      setIconSearch("");
    }
  }, [isOpen, initialData, initialValues, categories, nextSortOrder]);

  // Auto-generate slug & code
  const handleNameChange = (val: string) => {
    if (isEditing) {
      setFormData((prev) => ({ ...prev, name: val }));
      return;
    }

    const name = val;
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    // Auto generate uppercase code separated by underscore
    const code = name
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/Đ/g, "D")
      .replace(/[^A-Z0-9\s_]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .substring(0, 50);

    setFormData((prev) => ({ ...prev, name, slug, code }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverImage(file);
      setCoverImagePreview(URL.createObjectURL(file));
    }
  };

  const handleDeleteImage = async () => {
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
      } catch (err: any) {
        setError(err.message || "Lỗi khi xóa ảnh");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCoverImage(null);
      setCoverImagePreview(initialData?.coverImageUrl || null);
    }
  };

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

      const payload: ServiceFormPayload = {
        ...formData,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        slug: formData.slug.trim().toLowerCase(),
        description: formData.description.trim() || null,
        iconUrl: formData.iconUrl.trim() || null,
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
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra khi lưu dịch vụ.");
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

                <div className="space-y-1.5 relative" ref={iconPickerRef}>
                  <label className="text-sm font-semibold text-slate-700">
                    Mã Icon (Material Symbols)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      {formData.iconUrl ? (
                        <span className="material-symbols-outlined text-[#0f766e] text-xl leading-none">
                          {formData.iconUrl}
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded border border-slate-300 border-dashed inline-block bg-slate-100"></span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={formData.iconUrl}
                      onChange={(e) => {
                        setFormData({ ...formData, iconUrl: e.target.value });
                        setIconSearch(e.target.value);
                        setShowIconPicker(true);
                      }}
                      onFocus={() => setShowIconPicker(true)}
                      placeholder="VD: scissors, spa, face_retouching_natural"
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0f766e] transition"
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

                  {showIconPicker && (
                    <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="p-3 max-h-60 overflow-y-auto grid grid-cols-4 md:grid-cols-5 gap-2 custom-scrollbar">
                        {COMMON_ICONS.filter(
                          (icon) =>
                            icon.name
                              .toLowerCase()
                              .includes(iconSearch.toLowerCase()) ||
                            icon.label
                              .toLowerCase()
                              .includes(iconSearch.toLowerCase()),
                        ).length > 0 ? (
                          COMMON_ICONS.filter(
                            (icon) =>
                              icon.name
                                .toLowerCase()
                                .includes(iconSearch.toLowerCase()) ||
                              icon.label
                                .toLowerCase()
                                .includes(iconSearch.toLowerCase()),
                          ).map((icon) => (
                            <button
                              key={icon.name}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  iconUrl: icon.name,
                                }));
                                setIconSearch(icon.name);
                                setShowIconPicker(false);
                              }}
                              className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${formData.iconUrl === icon.name ? "bg-teal-50 border border-[#0f766e] text-[#0f766e]" : "bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 hover:border-slate-300"}`}
                              title={icon.label}
                            >
                              <span className="material-symbols-outlined text-2xl mb-1">
                                {icon.name}
                              </span>
                              <span className="text-[10px] text-center line-clamp-1 opacity-70 font-medium w-full">
                                {icon.label}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="col-span-full py-4 text-center text-sm text-slate-500">
                            Sử dụng icon tuỳ chỉnh:{" "}
                            <strong>{iconSearch}</strong>
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Mã Google Material Symbols</span>
                        <a
                          href="https://fonts.google.com/icons?icon.set=Material+Symbols"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#0f766e] hover:underline font-semibold"
                        >
                          Tìm thêm icon tại đây
                        </a>
                      </div>
                    </div>
                  )}
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
                        targetAudience: e.target.value as any,
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

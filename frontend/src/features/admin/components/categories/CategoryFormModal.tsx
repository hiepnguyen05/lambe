/* eslint-disable react/set-state-in-effect -- Opening a record intentionally resets the modal draft. */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Upload, Trash2, ChevronDown, Loader2 } from 'lucide-react';
import { LambeIcon } from '../../../../components/ui/LambeIcon';
import type { AdminCategory } from '../../hooks/useAdminCategories';
import {
  commonCatalogIcons,
  generateCatalogCode,
  generateCatalogSlug,
  parseIconValue,
  buildIconValue,
} from '../../utils/catalog-form';
import { uploadAdminImage } from '../../utils/admin-upload';

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AdminCategory>, file: File | null) => Promise<void>;
  initialData?: AdminCategory | null;
  isLoading?: boolean;
  nextSortOrder?: number;
  onRemoveCover?: () => Promise<void>;
}

export function CategoryFormModal({ isOpen, onClose, onSubmit, initialData, isLoading, nextSortOrder = 1, onRemoveCover }: CategoryFormModalProps) {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    slug: '',
    description: '',
    iconUrl: '',
    sortOrder: nextSortOrder,
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Icon Picker state
  const [iconCode, setIconCode] = useState('layout_grid');
  const [iconImageUrl, setIconImageUrl] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [uploadIconError, setUploadIconError] = useState<string | null>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parsedIcon = parseIconValue(initialData?.iconUrl);
    setIconCode(parsedIcon.iconCode);
    setIconImageUrl(parsedIcon.iconImageUrl);
    setIconSearch(parsedIcon.iconCode);

    if (initialData) {
      // eslint-disable-next-line react/set-state-in-effect
      setFormData({
        code: initialData.code || '',
        name: initialData.name || '',
        slug: initialData.slug || '',
        description: initialData.description || '',
        iconUrl: initialData.iconUrl || '',
        sortOrder: initialData.sortOrder || 0,
      });
      setPreviewUrl(initialData.coverImageUrl || null);
    } else {
      setFormData({
        code: '',
        name: '',
        slug: '',
        description: '',
        iconUrl: '',
        sortOrder: nextSortOrder,
      });
      setPreviewUrl(null);
    }
    setSelectedFile(null);
    setShowIconPicker(false);
    setIsUploadingIcon(false);
    setUploadIconError(null);
  }, [initialData, isOpen, nextSortOrder]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(event.target as Node)) {
        setShowIconPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      let next = { ...prev, [name]: name === 'sortOrder' ? parseInt(value) || 0 : value };
      
      // Auto-generate code and slug if name changes
      if (name === 'name' && !initialData) {
        // Only update code/slug if they are empty or still match the auto-generated version of the old name
        const oldCode = generateCatalogCode(prev.name);
        const oldSlug = generateCatalogSlug(prev.name);
        
        if (!prev.code || prev.code === oldCode) {
          next = { ...next, code: generateCatalogCode(value) };
        }
        if (!prev.slug || prev.slug === oldSlug) {
          next = { ...next, slug: generateCatalogSlug(value) };
        }
      }
      
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setIsUploadingIcon(true);
    setUploadIconError(null);
    try {
      const uploaded = await uploadAdminImage(file, 'categories');
      setIconImageUrl(uploaded.secureUrl);
      setShowIconPicker(false);
    } catch (err: unknown) {
      setUploadIconError(err instanceof Error ? err.message : 'Lỗi khi tải ảnh icon lên.');
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalIconUrl = buildIconValue(iconCode, iconImageUrl);
    await onSubmit({ ...formData, iconUrl: finalIconUrl }, selectedFile);
  };

  const filteredIcons = useMemo(() => {
    const query = iconSearch.toLowerCase();
    return commonCatalogIcons.filter(icon =>
      icon.name.toLowerCase().includes(query) ||
      icon.label.toLowerCase().includes(query)
    );
  }, [iconSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-extrabold text-slate-800">
            {initialData ? 'Chỉnh sửa danh mục' : 'Thêm mới danh mục'}
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="categoryForm" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Tên danh mục <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Ví dụ: Dịch vụ Tóc"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Mã danh mục <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  disabled={!!initialData}
                  placeholder="Ví dụ: HAIR"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {initialData ? 'Mã danh mục không thể thay đổi sau khi tạo' : 'Sẽ tự động tạo từ tên nếu trống'}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Slug <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  required
                  placeholder="Ví dụ: dich-vu-toc"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Thứ tự hiển thị</label>
                <input 
                  type="number" 
                  name="sortOrder"
                  value={formData.sortOrder}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700">Mô tả</label>
                <span className={`text-xs ${formData.description.length >= 500 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                  {formData.description.length}/500 ký tự
                </span>
              </div>
              <textarea 
                name="description"
                value={formData.description}
                onChange={handleChange}
                maxLength={500}
                rows={3}
                placeholder="Mô tả ngắn gọn về danh mục (tối đa 500 ký tự)..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium resize-none"
              ></textarea>
            </div>

            <div className="space-y-3 relative p-4 rounded-xl bg-slate-50 border border-slate-200" ref={iconPickerRef}>
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800">
                  Cấu hình Icon danh mục
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
                    className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showIconPicker ? 'rotate-180' : ''}`}
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
                                ? 'bg-teal-50 border border-[#0f766e] text-[#0f766e]'
                                : 'bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
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
                          isUploadingIcon ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        {isUploadingIcon ? 'Đang đổi...' : 'Đổi ảnh'}
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
                        onClick={() => setIconImageUrl('')}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                        title="Xóa ảnh icon (quay về dùng icon vector)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 bg-white border border-dashed border-slate-300 rounded-xl">
                    <div className="text-xs text-slate-500">
                      Chưa tải ảnh icon riêng. Đang dùng mã icon vector <strong className="text-slate-700 font-semibold">{iconCode}</strong>.
                    </div>
                    <label
                      className={`cursor-pointer px-3 py-1.5 bg-[#0f766e]/10 hover:bg-[#0f766e]/20 text-[#0f766e] text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                        isUploadingIcon ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      {isUploadingIcon ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{isUploadingIcon ? 'Đang tải...' : 'Tải ảnh JPG/PNG lên'}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        className="hidden"
                        disabled={isUploadingIcon}
                        onChange={handleIconUpload}
                      />
                    </label>
                  </div>
                )}

                {uploadIconError && (
                  <p className="text-xs text-rose-500 font-medium">{uploadIconError}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 block mb-2">Ảnh bìa</label>
              <div className="flex items-start gap-4">
                {previewUrl ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-200 w-32 h-32 flex-shrink-0 bg-slate-50">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={async () => {
                        if (previewUrl && previewUrl.startsWith('blob:')) {
                          URL.revokeObjectURL(previewUrl);
                        }
                        if (initialData?.coverImageUrl && !selectedFile && onRemoveCover) {
                          await onRemoveCover();
                        }
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center text-white transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <label className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:text-[#0f766e] hover:border-[#0f766e] hover:bg-teal-50 cursor-pointer transition-colors">
                    <Upload className="w-6 h-6 mb-2" />
                    <span className="text-xs font-semibold">Tải ảnh lên</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange}
                    />
                  </label>
                )}
                <div className="flex-1">
                  <p className="text-sm text-slate-500">Khuyến nghị ảnh có tỉ lệ 1:1, dung lượng không quá 5MB. Định dạng JPEG, PNG hoặc WEBP.</p>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
          <button 
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-5 py-2.5 text-slate-600 bg-white border border-slate-200 text-sm font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button 
            type="submit"
            form="categoryForm"
            disabled={isLoading}
            className="px-5 py-2.5 bg-[#0f766e] text-white text-sm font-bold rounded-xl shadow-sm hover:bg-[#0d5f58] shadow-[#0f766e]/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center min-w-[120px]"
          >
            {isLoading ? 'Đang lưu...' : (initialData ? 'Cập nhật' : 'Thêm mới')}
          </button>
        </div>
      </div>
    </div>
  );
}

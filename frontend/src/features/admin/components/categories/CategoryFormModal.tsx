import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, ChevronDown } from 'lucide-react';
import type { AdminCategory } from '../../hooks/useAdminCategories';

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<AdminCategory>, file: File | null) => Promise<void>;
  initialData?: AdminCategory | null;
  isLoading?: boolean;
  nextSortOrder?: number;
}

const COMMON_ICONS = [
  { name: 'content_cut', label: 'Cắt tóc' },
  { name: 'spa', label: 'Spa & Massage' },
  { name: 'face', label: 'Chăm sóc da' },
  { name: 'face_retouching_natural', label: 'Trang điểm' },
  { name: 'brush', label: 'Làm móng / Cọ' },
  { name: 'palette', label: 'Nhuộm / Màu' },
  { name: 'wash', label: 'Gội đầu' },
  { name: 'healing', label: 'Trị liệu' },
  { name: 'local_florist', label: 'Thảo mộc' },
  { name: 'clean_hands', label: 'Vệ sinh' },
  { name: 'health_and_safety', label: 'Phòng khám' },
  { name: 'self_improvement', label: 'Thư giãn' },
  { name: 'favorite', label: 'Yêu thích' },
  { name: 'star', label: 'Nổi bật' },
  { name: 'category', label: 'Mặc định' }
];

const generateSlug = (text: string) => {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/([^0-9a-z-\s])/g, '')
    .replace(/(\s+)/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const generateCode = (text: string) => {
  return text.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đ]/g, 'D')
    .replace(/([^0-9A-Z_\s])/g, '')
    .replace(/(\s+)/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 50); // max length
};

export function CategoryFormModal({ isOpen, onClose, onSubmit, initialData, isLoading, nextSortOrder = 1 }: CategoryFormModalProps) {
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
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) {
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
    setIconSearch('');
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
      const updates: any = { [name]: name === 'sortOrder' ? parseInt(value) || 0 : value };
      
      // Auto-generate code and slug if name changes
      if (name === 'name' && !initialData) {
        // Only update code/slug if they are empty or still match the auto-generated version of the old name
        const oldCode = generateCode(prev.name);
        const oldSlug = generateSlug(prev.name);
        
        if (!prev.code || prev.code === oldCode) {
          updates.code = generateCode(value);
        }
        if (!prev.slug || prev.slug === oldSlug) {
          updates.slug = generateSlug(value);
        }
      }
      
      return { ...prev, ...updates };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData, selectedFile);
  };

  const filteredIcons = COMMON_ICONS.filter(icon => 
    icon.name.toLowerCase().includes(iconSearch.toLowerCase()) || 
    icon.label.toLowerCase().includes(iconSearch.toLowerCase())
  );

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
              <label className="text-sm font-bold text-slate-700">Mô tả</label>
              <textarea 
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                placeholder="Mô tả ngắn gọn về danh mục..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium resize-none"
              ></textarea>
            </div>

            <div className="space-y-2 relative" ref={iconPickerRef}>
              <label className="text-sm font-bold text-slate-700 block mb-1">Tên icon (Material Symbol)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  {formData.iconUrl ? (
                    <span className="material-symbols-outlined text-[#0f766e] text-xl leading-none">{formData.iconUrl}</span>
                  ) : (
                    <span className="w-5 h-5 rounded border border-slate-300 border-dashed inline-block bg-slate-100"></span>
                  )}
                </div>
                <input 
                  type="text" 
                  name="iconUrl"
                  value={formData.iconUrl}
                  onChange={(e) => {
                    handleChange(e);
                    setIconSearch(e.target.value);
                    setShowIconPicker(true);
                  }}
                  onFocus={() => setShowIconPicker(true)}
                  placeholder="Nhập tên icon (VD: spa, face) hoặc chọn bên dưới..."
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20 focus:border-[#0f766e] transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showIconPicker ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Popup cho phép chọn Icon */}
              {showIconPicker && (
                <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-3 max-h-60 overflow-y-auto grid grid-cols-4 md:grid-cols-5 gap-2 custom-scrollbar">
                    {filteredIcons.length > 0 ? filteredIcons.map((icon) => (
                      <button
                        key={icon.name}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, iconUrl: icon.name }));
                          setIconSearch(icon.name);
                          setShowIconPicker(false);
                        }}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${formData.iconUrl === icon.name ? 'bg-teal-50 border border-[#0f766e] text-[#0f766e]' : 'bg-slate-50 border border-slate-100 text-slate-600 hover:bg-slate-100 hover:border-slate-300'}`}
                        title={icon.label}
                      >
                        <span className="material-symbols-outlined text-2xl mb-1">{icon.name}</span>
                        <span className="text-[10px] text-center line-clamp-1 opacity-70 font-medium w-full">{icon.label}</span>
                      </button>
                    )) : (
                      <div className="col-span-full py-4 text-center text-sm text-slate-500">
                        Sử dụng icon tuỳ chỉnh: <strong>{iconSearch}</strong>
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Mã Google Material Symbols</span>
                    <a href="https://fonts.google.com/icons?icon.set=Material+Symbols" target="_blank" rel="noreferrer" className="text-[#0f766e] hover:underline font-semibold">
                      Tìm thêm icon tại đây
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 block mb-2">Ảnh bìa</label>
              <div className="flex items-start gap-4">
                {previewUrl ? (
                  <div className="relative group rounded-xl overflow-hidden border border-slate-200 w-32 h-32 flex-shrink-0 bg-slate-50">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
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

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  CheckCircle2,
  FileText,
  UploadCloud,
  Users,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  MapPin,
  Phone,
  Mail,
  User,
  AlertCircle,
  FileCheck,
  Image as ImageIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest, ApiError } from '../../../lib/api-client';

interface ServiceItem {
  id: string;
  name: string;
  code: string;
  minPriceAmount: number;
  maxPriceAmount: number;
  defaultDurationMinutes: number;
  category?: {
    id: string;
    name: string;
  };
}

interface RegisterFormData {
  // Step 1: Legal Info
  businessName: string;
  taxCode: string;
  businessRegistrationNumber: string;
  representativeName: string;
  phone: string;
  email: string;
  address: string;
  city: string;

  // Step 2: Documents
  notes: string;

  // Step 3: Scale & Services
  branchCount: number;
  staffCount: number;
  selectedServiceIds: string[];
}

export function ProviderRegisterScreen() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Available services from backend
  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  // Files
  const [businessLicenseFile, setBusinessLicenseFile] = useState<File | null>(null);
  const [portraitFile, setPortraitFile] = useState<File | null>(null);

  const licenseInputRef = useRef<HTMLInputElement>(null);
  const portraitInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<RegisterFormData>({
    businessName: '',
    taxCode: '',
    businessRegistrationNumber: '',
    representativeName: '',
    phone: '',
    email: '',
    address: '',
    city: 'Hồ Chí Minh',
    notes: '',
    branchCount: 1,
    staffCount: 5,
    selectedServiceIds: [],
  });

  useEffect(() => {
    async function fetchServices() {
      setIsLoadingServices(true);
      try {
        const res = await apiRequest<{ data: ServiceItem[] }>('/services');
        if (Array.isArray(res?.data)) {
          setAvailableServices(res.data);
          if (res.data.length > 0) {
            setFormData((prev) => ({
              ...prev,
              selectedServiceIds: [res.data[0].id],
            }));
          }
        }
      } catch {
        // Fallback if API is offline or returns unexpected data
      } finally {
        setIsLoadingServices(false);
      }
    }
    fetchServices();
  }, []);

  const handleTextChange = (
    field: keyof RegisterFormData,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleService = (id: string) => {
    setFormData((prev) => {
      const exists = prev.selectedServiceIds.includes(id);
      return {
        ...prev,
        selectedServiceIds: exists
          ? prev.selectedServiceIds.filter((sId) => sId !== id)
          : [...prev.selectedServiceIds, id],
      };
    });
  };

  const handleLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setBusinessLicenseFile(e.target.files[0]);
    }
  };

  const handlePortraitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPortraitFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setNeedsAuth(false);

    try {
      // 1. Tạo hồ sơ nháp loại ORGANIZATION
      const createRes = await apiRequest<{ data: { id: string } }>('/provider-applications', {
        method: 'POST',
        body: JSON.stringify({ providerType: 'ORGANIZATION' }),
      });
      const applicationId = createRes.data?.id;

      if (!applicationId) {
        throw new Error('Không nhận được mã hồ sơ từ máy chủ.');
      }

      // 2. Cập nhật thông tin pháp lý doanh nghiệp
      await apiRequest(`/provider-applications/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          organizationName: formData.businessName.trim(),
          taxCode: formData.taxCode.trim(),
          businessRegistrationNumber: formData.businessRegistrationNumber.trim(),
          registeredAddress: `${formData.address.trim()}, ${formData.city.trim()}`,
          representativeName: formData.representativeName.trim(),
          email: formData.email.trim().toLowerCase(),
          biography: `Quy mô: ${formData.branchCount} cơ sở, ${formData.staffCount} nhân sự. ${formData.notes}`.trim(),
        }),
      });

      // 3. Đăng ký các dịch vụ đã chọn
      for (const serviceId of formData.selectedServiceIds) {
        const service = availableServices.find((s) => s.id === serviceId);
        if (service) {
          await apiRequest(`/provider-applications/${applicationId}/services`, {
            method: 'POST',
            body: JSON.stringify({
              serviceId: service.id,
              proposedPrice: service.minPriceAmount || 100000,
              durationMinutes: service.defaultDurationMinutes || 60,
            }),
          });
        }
      }

      // 4. Tải lên tài liệu: Giấy phép kinh doanh (BUSINESS_LICENSE)
      if (businessLicenseFile) {
        const licenseForm = new FormData();
        licenseForm.append('file', businessLicenseFile);
        await apiRequest(`/provider-applications/${applicationId}/documents/BUSINESS_LICENSE`, {
          method: 'POST',
          body: licenseForm,
        });
      }

      // 5. Tải lên tài liệu: Ảnh đại diện tổ chức / Salon (PORTRAIT)
      if (portraitFile) {
        const portraitForm = new FormData();
        portraitForm.append('file', portraitFile);
        await apiRequest(`/provider-applications/${applicationId}/documents/PORTRAIT`, {
          method: 'POST',
          body: portraitForm,
        });
      }

      // 6. Chấp thuận điều khoản nhà cung cấp
      await apiRequest(`/provider-applications/${applicationId}/terms/accept`, {
        method: 'POST',
        body: JSON.stringify({ accepted: true }),
      });

      // 7. Nộp hồ sơ xét duyệt chính thức
      await apiRequest(`/provider-applications/${applicationId}/submit`, {
        method: 'POST',
      });

      setIsSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        // Người dùng chưa có phiên đăng nhập trên trình duyệt
        setNeedsAuth(true);
      } else {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Có lỗi xảy ra khi nộp hồ sơ. Vui lòng kiểm tra lại thông tin.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-800 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              L
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">
                Lambe Business
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-teal-50 text-teal-700 rounded-full border border-teal-200">
                Đối tác Tổ chức
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-500 hidden sm:inline">
              Đã có tài khoản đối tác?
            </span>
            <Link
              to="/admin/login"
              className="font-medium text-teal-700 hover:text-teal-800 hover:underline"
            >
              Đăng nhập Quản trị
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Intro */}
      <div className="bg-gradient-to-b from-teal-900 via-teal-800 to-slate-900 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-700/40 text-teal-200 text-xs font-medium mb-4 border border-teal-600/30">
            <Sparkles className="w-3.5 h-3.5" />
            Cổng Đăng Ký Doanh Nghiệp Làm Đẹp & Chuỗi Spa
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Mở rộng tệp khách hàng cao cấp cùng Lambe
          </h1>
          <p className="text-teal-100 max-w-2xl mx-auto text-base sm:text-lg">
            Hệ thống quản lý điều phối thợ thông minh, phân công dịch vụ theo ca,
            đối soát tiền mặt minh bạch và tiếp cận hàng vạn khách hàng đặt lịch
            mỗi ngày.
          </p>
        </div>
      </div>

      {/* Main Form Container */}
      <main className="max-w-4xl mx-auto px-4 -mt-6 pb-20">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          {isSuccess ? (
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Hồ sơ đối tác đã được gửi lên hệ thống xét duyệt!
              </h2>
              <p className="text-slate-600 max-w-lg mx-auto mb-6">
                Cảm ơn <strong>{formData.businessName || 'Doanh nghiệp'}</strong> đã
                tin tưởng đồng hành. Ban quản trị Lambe sẽ tiến hành thẩm định hồ sơ
                và thông báo kết quả qua email <strong>{formData.email}</strong> hoặc
                gọi tới <strong>{formData.phone}</strong>.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-md mx-auto text-left text-sm text-slate-600 mb-8">
                <div className="flex justify-between py-1">
                  <span>Mã số thuế:</span>
                  <span className="font-semibold text-slate-900">
                    {formData.taxCode}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Số ĐKKD:</span>
                  <span className="font-semibold text-slate-900">
                    {formData.businessRegistrationNumber}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Người đại diện:</span>
                  <span className="font-semibold text-slate-900">
                    {formData.representativeName}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Quy mô:</span>
                  <span className="font-semibold text-slate-900">
                    {formData.branchCount} cơ sở • {formData.staffCount} nhân viên
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setCurrentStep(1);
                }}
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-xl transition"
              >
                Gửi thêm hồ sơ chi nhánh khác
              </button>
            </div>
          ) : (
            <div>
              {/* Stepper Navigation */}
              <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`py-4 px-4 text-center font-semibold text-sm flex items-center justify-center gap-2 border-b-2 transition ${
                    currentStep === 1
                      ? 'border-teal-700 text-teal-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs flex items-center justify-center font-bold">
                    1
                  </span>
                  <span>Pháp nhân Doanh nghiệp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`py-4 px-4 text-center font-semibold text-sm flex items-center justify-center gap-2 border-b-2 transition ${
                    currentStep === 2
                      ? 'border-teal-700 text-teal-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>Hồ sơ Pháp lý & GPKD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className={`py-4 px-4 text-center font-semibold text-sm flex items-center justify-center gap-2 border-b-2 transition ${
                    currentStep === 3
                      ? 'border-teal-700 text-teal-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs flex items-center justify-center font-bold">
                    3
                  </span>
                  <span>Dịch vụ & Nộp duyệt</span>
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-6 sm:p-8">
                {errorMessage && (
                  <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {needsAuth && (
                  <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      Yêu cầu tài khoản Lambe để gửi hồ sơ trực tiếp
                    </div>
                    <p className="text-xs text-amber-700 mb-3">
                      Để bảo mật dữ liệu doanh nghiệp và liên kết tài khoản chủ sở hữu, vui lòng đăng nhập trước khi nộp hồ sơ.
                    </p>
                    <div className="flex items-center gap-3">
                      <Link
                        to="/admin/login"
                        className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold inline-block"
                      >
                        Đăng nhập ngay
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setNeedsAuth(false);
                          setIsSuccess(true);
                        }}
                        className="px-4 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-50"
                      >
                        Tiếp tục với tư cách Lead tư vấn
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 1 */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-teal-700" />
                        Thông tin Pháp nhân Doanh nghiệp
                      </h3>
                      <p className="text-sm text-slate-500">
                        Nhập chính xác theo Giấy chứng nhận Đăng ký Doanh nghiệp
                        hoặc Hộ kinh doanh.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tên đầy đủ của Doanh nghiệp / Hộ kinh doanh (*)
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.businessName}
                          onChange={(e) =>
                            handleTextChange('businessName', e.target.value)
                          }
                          placeholder="Ví dụ: Công ty TNHH Thẩm Mỹ Viện Lambe Beauty"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Mã số thuế (*)
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.taxCode}
                          onChange={(e) =>
                            handleTextChange('taxCode', e.target.value)
                          }
                          placeholder="10 hoặc 13 chữ số"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Số ĐKKD / Giấy chứng nhận ĐKDN (*)
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.businessRegistrationNumber}
                          onChange={(e) =>
                            handleTextChange('businessRegistrationNumber', e.target.value)
                          }
                          placeholder="Số ghi trên giấy phép ĐKKD"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Người đại diện pháp luật (*)
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            required
                            value={formData.representativeName}
                            onChange={(e) =>
                              handleTextChange(
                                'representativeName',
                                e.target.value
                              )
                            }
                            placeholder="Họ và tên người đại diện"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Số điện thoại liên hệ quản lý (*)
                        </label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={(e) =>
                              handleTextChange('phone', e.target.value)
                            }
                            placeholder="Số điện thoại nhận thông báo"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Email nhận báo cáo đối soát & hợp đồng (*)
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) =>
                              handleTextChange('email', e.target.value)
                            }
                            placeholder="ketoan@lambebeauty.vn"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tỉnh / Thành phố (*)
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.city}
                          onChange={(e) =>
                            handleTextChange('city', e.target.value)
                          }
                          placeholder="Hồ Chí Minh, Hà Nội, Đà Nẵng..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Địa chỉ trụ sở / Văn phòng điều hành (*)
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                          <input
                            type="text"
                            required
                            value={formData.address}
                            onChange={(e) =>
                              handleTextChange('address', e.target.value)
                            }
                            placeholder="Số nhà, tên đường, phường/xã, quận/huyện (dùng cho hợp đồng & pháp lý)"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !formData.businessName ||
                            !formData.taxCode ||
                            !formData.businessRegistrationNumber ||
                            !formData.representativeName ||
                            !formData.email ||
                            !formData.address
                          ) {
                            setErrorMessage('Vui lòng điền đầy đủ các thông tin bắt buộc (*)');
                            return;
                          }
                          setErrorMessage(null);
                          setCurrentStep(2);
                        }}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-xl transition text-sm shadow-sm"
                      >
                        <span>Tiếp tục: Hồ sơ pháp lý</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2 */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-teal-700" />
                        Hồ sơ Pháp lý & Nhận diện Thương hiệu
                      </h3>
                      <p className="text-sm text-slate-500">
                        Dịch vụ làm đẹp được phục vụ tận nơi tại nhà khách hàng. Do đó, tổ chức chỉ cần Giấy phép ĐKKD và Logo thương hiệu (không yêu cầu mặt bằng salon đón khách hay CCCD cá nhân).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Business License */}
                      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                            <FileCheck className="w-4 h-4 text-teal-700" />
                            Giấy phép ĐKKD / Hộ kinh doanh
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-md font-medium">
                            Bắt buộc
                          </span>
                        </div>
                        <input
                          type="file"
                          ref={licenseInputRef}
                          onChange={handleLicenseChange}
                          accept="image/*,application/pdf"
                          className="hidden"
                        />
                        <div
                          onClick={() => licenseInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                            businessLicenseFile
                              ? 'border-emerald-500 bg-emerald-50/40'
                              : 'border-slate-300 hover:bg-slate-100/50'
                          }`}
                        >
                          <UploadCloud className="w-8 h-8 text-teal-700 mx-auto mb-2" />
                          <p className="text-xs text-slate-700 font-semibold truncate">
                            {businessLicenseFile ? businessLicenseFile.name : 'Nhấp để chọn file Giấy phép ĐKKD'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Hỗ trợ JPG, PNG, PDF tối đa 15MB
                          </p>
                        </div>
                      </div>

                      {/* Portrait / Brand Logo */}
                      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                            <ImageIcon className="w-4 h-4 text-teal-700" />
                            Logo thương hiệu / Nhận diện Đội ngũ
                          </span>
                          <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-md font-medium">
                            Bắt buộc
                          </span>
                        </div>
                        <input
                          type="file"
                          ref={portraitInputRef}
                          onChange={handlePortraitChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <div
                          onClick={() => portraitInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                            portraitFile
                              ? 'border-emerald-500 bg-emerald-50/40'
                              : 'border-slate-300 hover:bg-slate-100/50'
                          }`}
                        >
                          <UploadCloud className="w-8 h-8 text-teal-700 mx-auto mb-2" />
                          <p className="text-xs text-slate-700 font-semibold truncate">
                            {portraitFile ? portraitFile.name : 'Nhấp để chọn Logo thương hiệu hoặc Ảnh đội ngũ'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Hiển thị trên ứng dụng khi khách hàng đặt lịch
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-sm text-amber-900">
                      <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Mô hình Dịch vụ Tận nơi (Home Service)</p>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Vì kỹ thuật viên đến tận nhà phục vụ khách, nền tảng không đòi hỏi cơ sở vật chất salon đón khách. Trọng tâm đánh giá là tư cách pháp nhân, tiêu chuẩn vệ sinh an toàn và chứng chỉ tay nghề của từng thợ được phân công.
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition text-sm"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Quay lại</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-medium rounded-xl transition text-sm shadow-sm"
                      >
                        <span>Tiếp tục: Dịch vụ & Nộp duyệt</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-teal-700" />
                        Quy mô Đội ngũ & Dịch vụ Tận nơi
                      </h3>
                      <p className="text-sm text-slate-500">
                        Chọn các dịch vụ trong hệ thống Lambe mà đội ngũ của bạn sẽ đến tận nhà khách hàng phục vụ.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Số lượng Khu vực / Cụm điều phối hoạt động
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={formData.branchCount}
                          onChange={(e) =>
                            handleTextChange(
                              'branchCount',
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Số lượng Kỹ thuật viên / Thợ lưu động dự kiến
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={formData.staffCount}
                          onChange={(e) =>
                            handleTextChange(
                              'staffCount',
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-2">
                        Dịch vụ đăng ký tiếp nhận trên sàn Lambe (*)
                      </label>
                      {isLoadingServices ? (
                        <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
                          Đang tải danh mục dịch vụ từ máy chủ...
                        </div>
                      ) : availableServices.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1">
                          {availableServices.map((service) => {
                            const isSelected = formData.selectedServiceIds.includes(service.id);
                            return (
                              <div
                                key={service.id}
                                onClick={() => toggleService(service.id)}
                                className={`p-3 rounded-xl border cursor-pointer text-xs font-medium flex items-center justify-between transition ${
                                  isSelected
                                    ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <div>
                                  <div className="font-semibold">{service.name}</div>
                                  <div className="text-[11px] text-slate-500">
                                    {service.category?.name || 'Dịch vụ'} • ~{service.defaultDurationMinutes} phút
                                  </div>
                                </div>
                                <div
                                  className={`w-4 h-4 rounded-md flex items-center justify-center border transition ${
                                    isSelected
                                      ? 'bg-teal-700 border-teal-700 text-white'
                                      : 'border-slate-300'
                                  }`}
                                >
                                  {isSelected && (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-xs text-slate-500 bg-slate-50 rounded-xl">
                          Chưa có danh mục dịch vụ nào khả dụng.
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          required
                          className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                        />
                        <span className="text-xs text-slate-600">
                          Tôi xác nhận là người đại diện hợp pháp của doanh nghiệp và đồng ý với{' '}
                          <span className="text-teal-700 font-semibold underline">
                            Điều khoản hợp tác nhà cung cấp
                          </span>{' '}
                          của Lambe.
                        </span>
                      </label>
                    </div>

                    <div className="flex justify-between pt-4">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition text-sm"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Quay lại</span>
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-2 px-8 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl transition text-sm shadow-md disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <span>Đang gửi hồ sơ lên hệ thống...</span>
                        ) : (
                          <>
                            <span>Gửi hồ sơ xét duyệt</span>
                            <CheckCircle2 className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

import { useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import type {
  ApproveServiceSuggestionInput,
  ProviderServiceSuggestion,
} from '../../../hooks/useProviderApplications';

interface ServiceSuggestionDialogProps {
  suggestion: ProviderServiceSuggestion | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (input: ApproveServiceSuggestionInput) => Promise<void>;
}

function normalizeText(value: string) {
  return value
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function makeSlug(value: string) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeCode(value: string) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

function createInitialForm(
  suggestion: ProviderServiceSuggestion,
): ApproveServiceSuggestionInput {
  return {
    categoryId: suggestion.categoryId,
    code: makeCode(suggestion.name),
    name: suggestion.name,
    slug: makeSlug(suggestion.name),
    description: suggestion.description,
    minPriceAmount: suggestion.proposedPriceAmount,
    maxPriceAmount: suggestion.proposedPriceAmount,
    defaultDurationMinutes: suggestion.durationMinutes,
    targetAudience: 'ALL',
    requiresCertificate: false,
    minPortfolioImages: 0,
    minExperienceYears: 0,
  };
}

export function ServiceSuggestionDialog({
  suggestion,
  ...props
}: ServiceSuggestionDialogProps) {
  if (!suggestion) return null;

  return (
    <ServiceSuggestionDialogContent
      key={suggestion.id}
      suggestion={suggestion}
      {...props}
    />
  );
}

function ServiceSuggestionDialogContent({
  suggestion,
  isSubmitting,
  onClose,
  onSubmit,
}: Omit<ServiceSuggestionDialogProps, 'suggestion'> & {
  suggestion: ProviderServiceSuggestion;
}) {
  const [form, setForm] = useState<ApproveServiceSuggestionInput>(() =>
    createInitialForm(suggestion),
  );
  const [error, setError] = useState('');

  const update = <K extends keyof ApproveServiceSuggestionInput>(
    key: K,
    value: ApproveServiceSuggestionInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const handleSubmit = async () => {
    if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(form.code)) {
      setError('Mã dịch vụ phải viết hoa, bắt đầu bằng chữ và chỉ gồm chữ, số, dấu gạch dưới.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      setError('Slug chỉ gồm chữ thường, số và dấu gạch ngang.');
      return;
    }
    if (form.name.trim().length < 2) {
      setError('Tên dịch vụ cần có ít nhất 2 ký tự.');
      return;
    }
    if (form.minPriceAmount < 1 || form.maxPriceAmount < form.minPriceAmount) {
      setError('Khoảng giá không hợp lệ.');
      return;
    }
    await onSubmit({ ...form, name: form.name.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Đóng hộp thoại"
        className="absolute inset-0 bg-slate-950/45"
        onClick={isSubmitting ? undefined : onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestion-dialog-title"
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h2 id="suggestion-dialog-title" className="font-bold text-slate-900">
                Tạo dịch vụ từ đề xuất
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Kiểm tra và chuẩn hóa dữ liệu trước khi thêm vào danh mục hệ thống.
              </p>
            </div>
          </div>
          <button
            type="button"
            title="Đóng"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <Field label="Tên dịch vụ" required>
            <input
              value={form.name}
              maxLength={100}
              onChange={(event) => update('name', event.target.value)}
              className="w-full rounded-md border-slate-300 text-sm focus:border-teal-700 focus:ring-teal-700"
            />
          </Field>
          <Field label="Danh mục">
            <input
              value={suggestion.category?.name ?? suggestion.categoryId}
              disabled
              className="w-full rounded-md border-slate-200 bg-slate-100 text-sm text-slate-600"
            />
          </Field>
          <Field label="Mã dịch vụ" required>
            <input
              value={form.code}
              maxLength={50}
              onChange={(event) => update('code', event.target.value.toUpperCase())}
              className="w-full rounded-md border-slate-300 font-mono text-sm focus:border-teal-700 focus:ring-teal-700"
            />
          </Field>
          <Field label="Slug" required>
            <input
              value={form.slug}
              maxLength={120}
              onChange={(event) => update('slug', event.target.value.toLowerCase())}
              className="w-full rounded-md border-slate-300 font-mono text-sm focus:border-teal-700 focus:ring-teal-700"
            />
          </Field>
          <Field label="Giá tối thiểu" required>
            <input
              type="number"
              min={1}
              value={form.minPriceAmount}
              onChange={(event) => update('minPriceAmount', Number(event.target.value))}
              className="w-full rounded-md border-slate-300 text-sm focus:border-teal-700 focus:ring-teal-700"
            />
          </Field>
          <Field label="Giá tối đa" required>
            <input
              type="number"
              min={1}
              value={form.maxPriceAmount}
              onChange={(event) => update('maxPriceAmount', Number(event.target.value))}
              className="w-full rounded-md border-slate-300 text-sm focus:border-teal-700 focus:ring-teal-700"
            />
          </Field>
          <Field label="Thời lượng mặc định (phút)">
            <input
              type="number"
              min={15}
              max={720}
              value={form.defaultDurationMinutes ?? ''}
              onChange={(event) =>
                update(
                  'defaultDurationMinutes',
                  event.target.value ? Number(event.target.value) : null,
                )
              }
              className="w-full rounded-md border-slate-300 text-sm focus:border-teal-700 focus:ring-teal-700"
            />
          </Field>
          <Field label="Đối tượng">
            <select
              value={form.targetAudience}
              onChange={(event) =>
                update('targetAudience', event.target.value as 'ALL' | 'MEN' | 'WOMEN')
              }
              className="w-full rounded-md border-slate-300 text-sm focus:border-teal-700 focus:ring-teal-700"
            >
              <option value="ALL">Tất cả</option>
              <option value="MEN">Nam</option>
              <option value="WOMEN">Nữ</option>
            </select>
          </Field>
          <Field label="Kinh nghiệm tối thiểu (năm)">
            <input
              type="number"
              min={0}
              max={80}
              value={form.minExperienceYears ?? 0}
              onChange={(event) => update('minExperienceYears', Number(event.target.value))}
              className="w-full rounded-md border-slate-300 text-sm focus:border-teal-700 focus:ring-teal-700"
            />
          </Field>
          <Field label="Số ảnh portfolio tối thiểu">
            <input
              type="number"
              min={0}
              max={20}
              value={form.minPortfolioImages ?? 0}
              onChange={(event) => update('minPortfolioImages', Number(event.target.value))}
              className="w-full rounded-md border-slate-300 text-sm focus:border-teal-700 focus:ring-teal-700"
            />
          </Field>
          <label className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={form.requiresCertificate ?? false}
              onChange={(event) => update('requiresCertificate', event.target.checked)}
              className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
            />
            Yêu cầu chứng chỉ chuyên môn
          </label>
          <Field label="Mô tả" className="md:col-span-2">
            <textarea
              rows={3}
              maxLength={1000}
              value={form.description ?? ''}
              onChange={(event) => update('description', event.target.value)}
              className="w-full rounded-md border-slate-300 text-sm focus:border-teal-700 focus:ring-teal-700"
            />
          </Field>
          {error && (
            <p className="text-sm font-medium text-rose-600 md:col-span-2">{error}</p>
          )}
        </div>

        <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang tạo...' : 'Tạo và chấp nhận'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function Field({
  label,
  required = false,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-rose-600">*</span>}
      </span>
      {children}
    </label>
  );
}

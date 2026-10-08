import { useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ReviewDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'success' | 'warning' | 'danger';
  noteRequired?: boolean;
  initialNote?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void> | void;
}

export function ReviewDialog({
  open,
  ...props
}: ReviewDialogProps) {
  if (!open) return null;

  return (
    <ReviewDialogContent
      key={`${props.title}:${props.initialNote ?? ''}`}
      {...props}
    />
  );
}

function ReviewDialogContent({
  title,
  description,
  confirmLabel,
  tone = 'warning',
  noteRequired = false,
  initialNote = '',
  isSubmitting = false,
  onClose,
  onConfirm,
}: Omit<ReviewDialogProps, 'open'>) {
  const [note, setNote] = useState(initialNote);
  const [validationError, setValidationError] = useState('');

  const handleConfirm = async () => {
    if (noteRequired && note.trim().length < 5) {
      setValidationError('Nội dung cần có ít nhất 5 ký tự.');
      return;
    }
    try {
      await onConfirm(note.trim());
    } catch {
      // The parent keeps the dialog open and renders the API error.
    }
  };

  const toneClasses = {
    success: 'bg-emerald-600 hover:bg-emerald-700',
    warning: 'bg-amber-600 hover:bg-amber-700',
    danger: 'bg-rose-600 hover:bg-rose-700',
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
        aria-labelledby="review-dialog-title"
        className="relative w-full max-w-lg rounded-lg bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                tone === 'success'
                  ? 'bg-emerald-100 text-emerald-700'
                  : tone === 'danger'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {tone === 'success' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 id="review-dialog-title" className="font-bold text-slate-900">
                {title}
              </h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
            </div>
          </div>
          <button
            type="button"
            title="Đóng"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-4">
          <label htmlFor="review-note" className="mb-2 block text-sm font-semibold text-slate-700">
            Nhận xét {noteRequired ? '(bắt buộc)' : '(không bắt buộc)'}
          </label>
          <textarea
            id="review-note"
            rows={5}
            maxLength={1000}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setValidationError('');
            }}
            placeholder="Ghi rõ kết quả kiểm tra hoặc nội dung đối tác cần bổ sung"
            className="w-full rounded-lg border-slate-300 text-sm focus:border-teal-700 focus:ring-teal-700"
          />
          <div className="mt-1 flex justify-between text-xs">
            <span className="text-rose-600">{validationError}</span>
            <span className="text-slate-400">{note.length}/1000</span>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleConfirm()}
            className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${toneClasses[tone]}`}
          >
            {isSubmitting ? 'Đang xử lý...' : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

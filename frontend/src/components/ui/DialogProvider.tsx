import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Info,
  LoaderCircle,
  X,
  XCircle,
} from 'lucide-react';
import { DialogContext, type DialogInputSuggestion, type DialogOptions, type DialogType } from './dialog-context';

const iconStyles: Record<DialogType, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-700',
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
};

function DialogIcon({ type }: { type: DialogType }) {
  const className = 'h-6 w-6';
  if (type === 'success') return <CheckCircle2 className={className} />;
  if (type === 'error') return <XCircle className={className} />;
  if (type === 'warning') return <AlertTriangle className={className} />;
  return <Info className={className} />;
}

function normalizeSuggestion(
  suggestion: string | DialogInputSuggestion,
): DialogInputSuggestion {
  return typeof suggestion === 'string'
    ? { label: suggestion, value: suggestion }
    : suggestion;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogVersionRef = useRef(0);

  const showDialog = useCallback((opts: DialogOptions) => {
    dialogVersionRef.current += 1;
    setOptions(opts);
    setInputValue(opts.inputDefaultValue ?? '');
    setInputError('');
    setIsSubmitting(false);
    setIsOpen(true);
  }, []);

  const hideDialog = useCallback(() => {
    dialogVersionRef.current += 1;
    setIsOpen(false);
    setOptions(null);
    setInputValue('');
    setInputError('');
    setIsSubmitting(false);
  }, []);

  useEffect(() => {
    if (!isOpen || isSubmitting) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hideDialog();
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [hideDialog, isOpen, isSubmitting]);

  const handleConfirm = async () => {
    if (!options || isSubmitting) return;

    const normalizedInput = inputValue.trim();
    if (options.withInput && options.inputRequired && !normalizedInput) {
      setInputError('Vui lòng nhập lý do xử lý.');
      return;
    }
    if (
      options.withInput &&
      options.inputMinLength &&
      normalizedInput.length < options.inputMinLength
    ) {
      setInputError(`Lý do phải có ít nhất ${options.inputMinLength} ký tự.`);
      return;
    }

    if (!options.onConfirm) {
      hideDialog();
      return;
    }

    const activeVersion = dialogVersionRef.current;
    setInputError('');
    setIsSubmitting(true);

    try {
      const shouldClose = await options.onConfirm(
        options.withInput ? normalizedInput : undefined,
      );
      if (dialogVersionRef.current === activeVersion && shouldClose !== false) {
        hideDialog();
      }
    } catch (error) {
      if (dialogVersionRef.current === activeVersion) {
        setInputError(
          error instanceof Error
            ? error.message
            : 'Không thể hoàn tất thao tác. Vui lòng thử lại.',
        );
      }
    } finally {
      if (dialogVersionRef.current === activeVersion) {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancel = () => {
    if (isSubmitting) return;
    const onCancel = options?.onCancel;
    hideDialog();
    onCancel?.();
  };

  const type = options?.type ?? 'info';
  const suggestions = (options?.inputSuggestions ?? []).map(normalizeSuggestion);
  const showCancel = Boolean(options?.withInput || options?.onCancel);
  const inputLength = inputValue.trim().length;

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog }}>
      {children}

      {isOpen && options && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Đóng hộp thoại"
            className="absolute inset-0 cursor-default bg-slate-950/45 backdrop-blur-[2px] animate-in fade-in duration-200"
            onClick={handleCancel}
            disabled={isSubmitting}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            aria-describedby="app-dialog-message"
            className={`relative flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${
              options.withInput ? 'max-w-xl' : 'max-w-md'
            }`}
          >
            <div className="flex shrink-0 items-start gap-4 border-b border-slate-200 px-5 py-5 pr-14">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconStyles[type]}`}
              >
                <DialogIcon type={type} />
              </span>
              <div className="min-w-0 pt-0.5">
                <h3 id="app-dialog-title" className="text-lg font-bold text-slate-950">
                  {options.title}
                </h3>
                <p
                  id="app-dialog-message"
                  className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600"
                >
                  {options.message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              aria-label="Đóng"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>

            {options.withInput && (
              <div className="space-y-4 overflow-y-auto px-5 py-5">
                {suggestions.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase text-slate-500">
                      Lý do thường dùng
                    </p>
                    <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
                      {suggestions.map((suggestion) => {
                        const selected = inputValue === suggestion.value;
                        return (
                          <button
                            type="button"
                            key={suggestion.value}
                            onClick={() => {
                              setInputValue(suggestion.value);
                              setInputError('');
                            }}
                            disabled={isSubmitting}
                            aria-pressed={selected}
                            className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              selected
                                ? 'bg-teal-50 text-teal-950'
                                : 'bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                selected
                                  ? 'border-teal-700 bg-teal-700 text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">
                                {suggestion.label}
                              </span>
                              {suggestion.description && (
                                <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                                  {suggestion.description}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label className="block">
                  <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
                    <span>
                      {options.inputLabel ?? 'Lý do xử lý'}
                      {options.inputRequired && <span className="ml-1 text-rose-600">*</span>}
                    </span>
                    <span className="text-xs font-normal text-slate-400">
                      {inputLength}
                      {options.inputMaxLength ? `/${options.inputMaxLength}` : ''}
                    </span>
                  </span>
                  <textarea
                    value={inputValue}
                    onChange={(event) => {
                      setInputValue(event.target.value);
                      if (inputError) setInputError('');
                    }}
                    placeholder={options.inputPlaceholder ?? 'Nhập nội dung...'}
                    maxLength={options.inputMaxLength}
                    rows={4}
                    autoFocus
                    disabled={isSubmitting}
                    aria-invalid={Boolean(inputError)}
                    className={`w-full resize-none rounded-md border bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 disabled:bg-slate-50 ${
                      inputError
                        ? 'border-rose-400 ring-1 ring-rose-400'
                        : 'border-slate-300 focus:border-teal-700 focus:ring-1 focus:ring-teal-700'
                    }`}
                  />
                  {inputError && (
                    <span className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {inputError}
                    </span>
                  )}
                </label>
              </div>
            )}

            {!options.withInput && inputError && (
              <div className="mx-5 mt-5 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{inputError}</span>
              </div>
            )}

            <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
              {showCancel && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {options.cancelText ?? 'Hủy'}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={isSubmitting}
                className={`inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  type === 'error'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : type === 'warning'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-teal-700 hover:bg-teal-800'
                }`}
              >
                {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Đang xử lý' : options.confirmText ?? 'Đóng'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </DialogContext.Provider>
  );
}

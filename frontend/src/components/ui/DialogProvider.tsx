import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type DialogType = 'success' | 'error' | 'info' | 'warning';

interface DialogOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  withInput?: boolean;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  inputSuggestions?: string[];
  onConfirm?: (inputValue?: string) => void;
  onCancel?: () => void;
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const [inputValue, setInputValue] = useState('');

  const showDialog = useCallback((opts: DialogOptions) => {
    setOptions(opts);
    setInputValue(opts.inputDefaultValue || '');
    setIsOpen(true);
  }, []);

  const hideDialog = useCallback(() => {
    setIsOpen(false);
    // Let the exit animation play before clearing content
    setTimeout(() => setOptions(null), 200);
  }, []);

  const handleConfirm = () => {
    if (options?.onConfirm) options.onConfirm(options.withInput ? inputValue : undefined);
    hideDialog();
  };

  const handleCancel = () => {
    if (options?.onCancel) options.onCancel();
    hideDialog();
  };

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog }}>
      {children}

      {/* Dialog Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={handleCancel}
          ></div>
          
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-elevated p-6 animate-in zoom-in-95 fade-in duration-200">
            <button 
              onClick={handleCancel}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Icon */}
              <div className="mb-4">
                {options?.type === 'success' && <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-6 h-6" /></div>}
                {options?.type === 'error' && <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center"><XCircle className="w-6 h-6" /></div>}
                {options?.type === 'info' && <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Info className="w-6 h-6" /></div>}
                {options?.type === 'warning' && <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center"><AlertTriangle className="w-6 h-6" /></div>}
                {(!options?.type) && <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center"><Info className="w-6 h-6" /></div>}
              </div>

              {/* Text */}
              <h3 className="text-lg font-bold text-slate-900 mb-1.5">{options?.title}</h3>
              <p className="text-sm text-slate-500 font-medium mb-6">{options?.message}</p>

              {options?.withInput && (
                <div className="w-full mb-6 text-left space-y-3">
                  {options.inputSuggestions && options.inputSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {options.inputSuggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => setInputValue(suggestion)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer ${
                            inputValue === suggestion
                              ? 'bg-[#0f766e] text-white border-[#0f766e]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={options.inputPlaceholder || 'Nhập dữ liệu...'}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f766e] focus:border-transparent transition-all"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-center gap-3 w-full">
                {options?.onCancel && (
                  <button
                    onClick={handleCancel}
                    className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
                  >
                    {options.cancelText || 'Hủy bỏ'}
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold text-white shadow-sm transition active:scale-95 cursor-pointer ${
                    options?.type === 'error' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 
                    options?.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' :
                    'bg-[#0f766e] hover:bg-[#0d5f58] shadow-[#0f766e]/20'
                  }`}
                >
                  {options?.confirmText || 'Đồng ý'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

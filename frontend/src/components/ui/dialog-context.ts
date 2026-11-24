import { createContext, useContext } from 'react'

export type DialogType = 'success' | 'error' | 'info' | 'warning'

export interface DialogInputSuggestion {
  label: string
  value: string
  description?: string
}

export interface DialogOptions {
  title: string
  message: string
  type?: DialogType
  confirmText?: string
  cancelText?: string
  withInput?: boolean
  inputLabel?: string
  inputPlaceholder?: string
  inputDefaultValue?: string
  inputRequired?: boolean
  inputMinLength?: number
  inputMaxLength?: number
  inputSuggestions?: Array<string | DialogInputSuggestion>
  onConfirm?: (inputValue?: string) => void | boolean | Promise<void | boolean>
  onCancel?: () => void
}

interface DialogContextValue {
  showDialog: (options: DialogOptions) => void
  hideDialog: () => void
}

export const DialogContext = createContext<DialogContextValue | undefined>(undefined)

export function useDialog() {
  const context = useContext(DialogContext)
  if (!context) throw new Error('useDialog must be used within a DialogProvider')
  return context
}

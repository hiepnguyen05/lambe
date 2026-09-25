import { useEffect, useRef, useState } from 'react'

export interface ToastState {
  title: string
  message: string
  icon: string
  tone: 'default' | 'error'
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<number | null>(null)

  const showToast = (nextToast: ToastState) => {
    setToast(nextToast)

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }

    timerRef.current = window.setTimeout(() => {
      setToast(null)
    }, 4000)
  }

  useEffect(
    () => () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    },
    [],
  )

  return { toast, showToast }
}

import { useEffect, useState } from 'react'
import { adminAuthApi } from '../api/admin-auth.api'
import type { AdminAccount } from '../types/admin-auth.types'

export function useAdminAuth() {
  const [account, setAccount] = useState<AdminAccount | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)

  // Document title side-effect
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Quản trị LAMBE'

    return () => {
      document.title = previousTitle
    }
  }, [])

  // Session restoration side-effect
  useEffect(() => {
    let isActive = true

    void adminAuthApi
      .restoreSession()
      .then((restoredAccount) => {
        if (isActive) setAccount(restoredAccount)
      })
      .catch(() => undefined)
      .finally(() => {
        if (isActive) setIsRestoring(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  const login = async (username: string, password: string): Promise<AdminAccount> => {
    setIsSubmitting(true)
    try {
      const loggedInAccount = await adminAuthApi.login(username, password)
      setAccount(loggedInAccount)
      return loggedInAccount
    } finally {
      setIsSubmitting(false)
    }
  }

  const logout = async (): Promise<void> => {
    setIsSubmitting(true)
    try {
      await adminAuthApi.logout()
      setAccount(null)
    } catch (error) {
      setAccount(null)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    account,
    isSubmitting,
    isRestoring,
    login,
    logout,
  }
}

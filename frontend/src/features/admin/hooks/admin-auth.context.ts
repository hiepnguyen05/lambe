import { createContext } from 'react'
import type { AdminAccount } from '../types/admin-auth.types'

export interface AdminAuthContextType {
  token: string | null
  account: AdminAccount | null
  isInitializing: boolean
  isAuthenticated: boolean
  login: (newToken: string, account: AdminAccount) => void
  logout: () => Promise<void>
}

export const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

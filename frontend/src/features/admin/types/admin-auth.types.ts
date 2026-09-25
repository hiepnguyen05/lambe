export interface AdminAccount {
  id: string
  username: string
  fullName: string
  email?: string | null
  roles: string[]
  mustChangePassword: boolean
  lastLoginAt?: string | null
}

export interface AdminSessionResponse {
  success: true
  message?: string
  data: {
    accessToken: string
    account: AdminAccount
  }
}

export interface AdminAccountResponse {
  success: true
  data: {
    account: AdminAccount
  }
}

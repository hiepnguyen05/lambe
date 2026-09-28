export interface User {
  id: string
  phone: string
  fullName: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  createdAt: string
  updatedAt: string
}

interface ApiResponse {
  success: true
  message: string
}

export type FirebaseTokenExchangeResponse = ApiResponse & {
  data:
    | {
      requiresPhoneVerification: true
      provider: 'google.com' | 'facebook.com'
      email: string | null
      suggestedFullName: string | null
    }
    | {
      requiresPhoneVerification: false
      isNewUser: true
      phone: string
      registrationToken: string
    }
    | {
      requiresPhoneVerification: false
      isNewUser: false
      accessToken: string
      user: User
    }
}

export interface AuthenticatedResponse extends ApiResponse {
  data: {
    accessToken: string
    user: User
  }
}

export interface PhoneLinkCheckResponse extends ApiResponse {
  data: {
    canLink: true
  }
}

export interface CurrentUserResponse {
  success: true
  data: {
    user: User
  }
}

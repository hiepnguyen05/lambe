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

export type SendOtpResponse = ApiResponse

export type VerifyOtpResponse =
  | (ApiResponse & {
      isNewUser: true
      data: {
        phone: string
        registrationToken: string
      }
    })
  | (ApiResponse & {
      isNewUser: false
      data: {
        accessToken: string
        user: User
      }
    })

export interface AuthenticatedResponse extends ApiResponse {
  data: {
    accessToken: string
    user: User
  }
}

export interface CurrentUserResponse {
  success: true
  data: {
    user: User
  }
}

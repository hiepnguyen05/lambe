import { apiRequest } from '../../../lib/api-client'
import type {
  AuthenticatedResponse,
  CurrentUserResponse,
  SendOtpResponse,
  VerifyOtpResponse,
} from '../types/auth.types'

export const authApi = {
  sendOtp(phone: string) {
    return apiRequest<SendOtpResponse>('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    })
  },

  verifyOtp(phone: string, code: string) {
    return apiRequest<VerifyOtpResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    })
  },

  completeRegistration(registrationToken: string, fullName: string) {
    return apiRequest<AuthenticatedResponse>('/auth/complete-registration', {
      method: 'POST',
      body: JSON.stringify({ registrationToken, fullName }),
    })
  },

  getCurrentUser(accessToken: string) {
    return apiRequest<CurrentUserResponse>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  },
}

import { apiRequest } from '../../../lib/api-client'
import type {
  AuthenticatedResponse,
  CurrentUserResponse,
  FirebaseTokenExchangeResponse,
  PhoneLinkCheckResponse,
} from '../types/auth.types'

export const authApi = {
  exchangeFirebaseToken(idToken: string) {
    return apiRequest<FirebaseTokenExchangeResponse>('/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    })
  },

  completeRegistration(registrationToken: string, fullName: string) {
    return apiRequest<AuthenticatedResponse>('/auth/complete-registration', {
      method: 'POST',
      body: JSON.stringify({ registrationToken, fullName }),
    })
  },

  checkFirebasePhoneLink(idToken: string, phone: string) {
    return apiRequest<PhoneLinkCheckResponse>('/auth/firebase/phone-link-check', {
      method: 'POST',
      body: JSON.stringify({ idToken, phone }),
    })
  },

  getCurrentUser(accessToken: string) {
    return apiRequest<CurrentUserResponse>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  },
}

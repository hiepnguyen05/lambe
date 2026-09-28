import { FirebaseError } from 'firebase/app'
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import { firebaseAuth } from '../../../config/firebase'

export type SocialAuthProvider = 'google' | 'facebook'

export async function signInWithSocialProvider(
  providerName: SocialAuthProvider,
): Promise<string> {
  const provider =
    providerName === 'google'
      ? new GoogleAuthProvider()
      : new FacebookAuthProvider()

  if (provider instanceof FacebookAuthProvider) {
    provider.addScope('email')
    provider.setCustomParameters({ display: 'popup' })
  } else {
    provider.setCustomParameters({ prompt: 'select_account' })
  }

  const credential = await signInWithPopup(firebaseAuth, provider)
  return credential.user.getIdToken()
}

export function getFirebaseSocialAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error
      ? error.message
      : 'Không thể đăng nhập. Vui lòng thử lại.'
  }

  switch (error.code) {
    case 'auth/popup-closed-by-user':
      return 'Bạn đã đóng cửa sổ đăng nhập trước khi hoàn tất.'
    case 'auth/popup-blocked':
      return 'Trình duyệt đã chặn cửa sổ đăng nhập. Vui lòng cho phép cửa sổ bật lên.'
    case 'auth/cancelled-popup-request':
      return 'Một yêu cầu đăng nhập khác đang được thực hiện.'
    case 'auth/account-exists-with-different-credential':
      return 'Email này đã được dùng với một phương thức đăng nhập khác.'
    case 'auth/operation-not-allowed':
      return 'Phương thức đăng nhập này chưa được bật trên Firebase.'
    case 'auth/unauthorized-domain':
      return 'Tên miền hiện tại chưa được cho phép trong Firebase Authentication.'
    case 'auth/network-request-failed':
      return 'Không thể kết nối Firebase. Vui lòng kiểm tra mạng và thử lại.'
    default:
      return 'Không thể đăng nhập bằng tài khoản này. Vui lòng thử lại.'
  }
}

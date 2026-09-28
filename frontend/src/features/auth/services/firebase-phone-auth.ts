import { FirebaseError } from 'firebase/app'
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from 'firebase/auth'
import { firebaseAuth } from '../../../config/firebase'

let recaptchaVerifier: RecaptchaVerifier | null = null
let recaptchaAttempt = 0
let sendOtpPromise: Promise<ConfirmationResult> | null = null

function createRecaptchaContainer(): string {
  const host = document.getElementById('firebase-recaptcha-container')

  if (!host) {
    throw new Error('Không tìm thấy vùng xác minh reCAPTCHA.')
  }

  host.replaceChildren()
  const container = document.createElement('div')
  container.id = `firebase-recaptcha-attempt-${++recaptchaAttempt}`
  host.appendChild(container)

  return container.id
}

export function clearFirebaseRecaptcha(): void {
  recaptchaVerifier?.clear()
  recaptchaVerifier = null
  sendOtpPromise = null
  document.getElementById('firebase-recaptcha-container')?.replaceChildren()
}

export async function sendFirebasePhoneOtp(
  phoneNumber: string,
): Promise<ConfirmationResult> {
  return requestFirebasePhoneOtp(phoneNumber, false)
}

export async function linkFirebaseUserWithPhone(
  phoneNumber: string,
): Promise<ConfirmationResult> {
  return requestFirebasePhoneOtp(phoneNumber, true)
}

async function requestFirebasePhoneOtp(
  phoneNumber: string,
  linkToCurrentUser: boolean,
): Promise<ConfirmationResult> {
  if (sendOtpPromise) return sendOtpPromise

  clearFirebaseRecaptcha()
  const containerId = createRecaptchaContainer()
  recaptchaVerifier = new RecaptchaVerifier(
    firebaseAuth,
    containerId,
    { size: 'invisible' },
  )

  const currentUser = firebaseAuth.currentUser
  if (linkToCurrentUser && !currentUser) {
    throw new Error(
      'Phiên đăng nhập mạng xã hội đã hết hạn. Vui lòng đăng nhập lại.',
    )
  }

  const request = linkToCurrentUser
    ? linkWithPhoneNumber(currentUser!, phoneNumber, recaptchaVerifier)
    : signInWithPhoneNumber(firebaseAuth, phoneNumber, recaptchaVerifier)
  sendOtpPromise = request

  try {
    return await request
  } finally {
    if (sendOtpPromise === request) sendOtpPromise = null
  }
}

export async function signOutFirebaseUser(): Promise<void> {
  clearFirebaseRecaptcha()
  if (firebaseAuth.currentUser) await signOut(firebaseAuth)
}

export function getFirebasePhoneAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error
      ? error.message
      : 'Đã có lỗi xảy ra. Vui lòng thử lại.'
  }

  switch (error.code) {
    case 'auth/invalid-phone-number':
      return 'Số điện thoại không hợp lệ.'
    case 'auth/invalid-verification-code':
      return 'Mã OTP không chính xác.'
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.'
    case 'auth/too-many-requests':
      return 'Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại.'
    case 'auth/quota-exceeded':
      return 'Hạn mức gửi SMS đã hết. Vui lòng liên hệ Lambe để được hỗ trợ.'
    case 'auth/captcha-check-failed':
    case 'auth/missing-client-type':
    case 'auth/invalid-app-credential':
      return 'Không thể xác minh reCAPTCHA. Vui lòng tải lại trang.'
    case 'auth/unauthorized-domain':
      return 'Tên miền hiện tại chưa được cho phép trong Firebase Authentication.'
    case 'auth/billing-not-enabled':
      return 'Firebase chưa được liên kết Cloud Billing để gửi SMS thật.'
    case 'auth/operation-not-allowed':
      return 'Đăng nhập bằng số điện thoại chưa được bật trên Firebase.'
    case 'auth/credential-already-in-use':
      return 'Số điện thoại này đã thuộc một tài khoản khác. Hãy đăng nhập bằng số điện thoại trước, sau đó liên kết Google hoặc Facebook trong hồ sơ.'
    case 'auth/provider-already-linked':
      return 'Số điện thoại đã được liên kết với tài khoản này.'
    default:
      return 'Không thể xác thực số điện thoại. Vui lòng thử lại.'
  }
}

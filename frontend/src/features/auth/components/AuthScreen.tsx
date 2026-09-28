import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ConfirmationResult } from 'firebase/auth'
import lambeLogo from '../../../assets/lambe-logo.svg'
import { firebaseAuth } from '../../../config/firebase'
import { authApi } from '../api/auth.api'
import { authSession } from '../services/auth-session'
import {
  clearFirebaseRecaptcha,
  getFirebasePhoneAuthErrorMessage,
  linkFirebaseUserWithPhone,
  sendFirebasePhoneOtp,
  signOutFirebaseUser,
} from '../services/firebase-phone-auth'
import {
  getFirebaseSocialAuthErrorMessage,
  signInWithSocialProvider,
  type SocialAuthProvider,
} from '../services/firebase-social-auth'
import type { FirebaseTokenExchangeResponse, User } from '../types/auth.types'
import {
  formatInternationalPhone,
  toE164VietnamesePhone,
  toVietnamesePhone,
  VIETNAMESE_PHONE_PATTERN,
} from '../utils/phone'
import { BrandShowcase } from './BrandShowcase'
import { PhoneStep } from './PhoneStep'
import { OtpStep } from './OtpStep'
import { ProfileStep } from './ProfileStep'
import { LoggedInView } from './LoggedInView'
import './AuthScreen.css'

type AuthStep = 'phone' | 'otp' | 'profile'
type PendingAction =
  | 'send'
  | 'verify'
  | 'register'
  | 'resend'
  | 'google'
  | 'facebook'
  | null

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}

export function AuthScreen() {
  const confirmationResultRef = useRef<ConfirmationResult | null>(null)
  const [step, setStep] = useState<AuthStep>('phone')
  const [phone, setPhone] = useState('')
  const [submittedPhone, setSubmittedPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [registrationToken, setRegistrationToken] = useState('')
  const [isLinkingSocialAccount, setIsLinkingSocialAccount] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isRestoringSession, setIsRestoringSession] = useState(() =>
    Boolean(authSession.getAccessToken()),
  )
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isActive = true
    const accessToken = authSession.getAccessToken()

    if (!accessToken) {
      return () => {
        isActive = false
      }
    }

    void authApi
      .getCurrentUser(accessToken)
      .then((response) => {
        if (isActive) {
          setUser(response.data.user)
        }
      })
      .catch(() => {
        authSession.clear()
      })
      .finally(() => {
        if (isActive) {
          setIsRestoringSession(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => () => clearFirebaseRecaptcha(), [])

  useEffect(() => {
    if (cooldown <= 0) return

    const timer = window.setInterval(() => {
      setCooldown((val) => Math.max(0, val - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [cooldown])

  const clearFeedback = () => {
    setError('')
    setMessage('')
  }

  const sendOtp = async (isResend = false) => {
    clearFeedback()
    const normalizedPhone = toVietnamesePhone(phone)

    if (!VIETNAMESE_PHONE_PATTERN.test(normalizedPhone)) {
      setError('Vui lòng nhập đúng 9 chữ số sau mã quốc gia +84.')
      return
    }

    setPendingAction(isResend ? 'resend' : 'send')

    try {
      const internationalPhone = toE164VietnamesePhone(normalizedPhone)

      if (isLinkingSocialAccount) {
        const currentFirebaseUser = firebaseAuth.currentUser

        if (!currentFirebaseUser) {
          throw new Error(
            'Phiên đăng nhập mạng xã hội đã hết hạn. Vui lòng đăng nhập lại.',
          )
        }

        const idToken = await currentFirebaseUser.getIdToken()
        await authApi.checkFirebasePhoneLink(idToken, normalizedPhone)
      }

      confirmationResultRef.current = isLinkingSocialAccount
        ? await linkFirebaseUserWithPhone(internationalPhone)
        : await sendFirebasePhoneOtp(internationalPhone)
      setSubmittedPhone(normalizedPhone)
      setOtpCode('')
      setStep('otp')
      setCooldown(60)
      setMessage(
        isLinkingSocialAccount
          ? 'Mã OTP đã được gửi để liên kết số điện thoại với tài khoản.'
          : 'Mã OTP đã được gửi đến số điện thoại của bạn.',
      )
    } catch (requestError) {
      setError(getFirebasePhoneAuthErrorMessage(requestError))
    } finally {
      setPendingAction(null)
    }
  }

  const handlePhoneSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void sendOtp()
  }

  const applyFirebaseExchange = (
    response: FirebaseTokenExchangeResponse,
  ) => {
    const result = response.data

    if (result.requiresPhoneVerification) {
      setIsLinkingSocialAccount(true)
      if (result.suggestedFullName) {
        setFullName(result.suggestedFullName)
      }
      setMessage(response.message)
      return
    }

    setIsLinkingSocialAccount(false)
    if (result.isNewUser) {
      setRegistrationToken(result.registrationToken)
      setStep('profile')
      setMessage(response.message)
      return
    }

    authSession.saveAccessToken(result.accessToken)
    setUser(result.user)
  }

  const handleSocialSignIn = async (provider: SocialAuthProvider) => {
    clearFeedback()
    setPendingAction(provider)

    try {
      const idToken = await signInWithSocialProvider(provider)
      const response = await authApi.exchangeFirebaseToken(idToken)
      applyFirebaseExchange(response)
    } catch (requestError) {
      setError(getFirebaseSocialAuthErrorMessage(requestError))
    } finally {
      setPendingAction(null)
    }
  }

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearFeedback()

    if (!/^\d{6}$/.test(otpCode)) {
      setError('Mã OTP phải gồm đúng 6 chữ số.')
      return
    }

    setPendingAction('verify')

    try {
      const confirmationResult = confirmationResultRef.current

      if (!confirmationResult) {
        setError('Phiên gửi OTP đã hết hạn. Vui lòng gửi lại mã.')
        return
      }

      const credential = await confirmationResult.confirm(otpCode)
      const idToken = await credential.user.getIdToken(true)
      const response = await authApi.exchangeFirebaseToken(idToken)
      applyFirebaseExchange(response)
    } catch (requestError) {
      setError(getFirebasePhoneAuthErrorMessage(requestError))
    } finally {
      setPendingAction(null)
    }
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearFeedback()
    const normalizedName = fullName.trim()

    if (normalizedName.length < 2) {
      setError('Vui lòng nhập họ và tên của bạn.')
      return
    }

    setPendingAction('register')

    try {
      const response = await authApi.completeRegistration(
        registrationToken,
        normalizedName,
      )
      authSession.saveAccessToken(response.data.accessToken)
      setUser(response.data.user)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setPendingAction(null)
    }
  }

  const handleLogout = () => {
    void signOutFirebaseUser().catch(() => undefined)
    authSession.clear()
    setUser(null)
    setStep('phone')
    setPhone('')
    setSubmittedPhone('')
    setOtpCode('')
    setFullName('')
    setRegistrationToken('')
    setIsLinkingSocialAccount(false)
    setCooldown(0)
    confirmationResultRef.current = null
    clearFeedback()
  }

  const goBackToPhone = () => {
    void signOutFirebaseUser().catch(() => undefined)
    setStep('phone')
    setOtpCode('')
    setRegistrationToken('')
    setIsLinkingSocialAccount(false)
    setSubmittedPhone('')
    setCooldown(0)
    confirmationResultRef.current = null
    clearFeedback()
  }

  const handleHeaderBack = () => {
    if (step !== 'phone') {
      goBackToPhone()
    } else {
      if (window.history.length > 1) {
        window.history.back()
      }
    }
  }

  // Loading view during session restoration
  if (isRestoringSession) {
    return (
      <main className="auth-root-container auth-root-container--loading">
        <div className="loading-logo-box" aria-label="Đang tải...">
          <img src={lambeLogo} alt="LAMBE Logo" className="loading-logo-img" />
        </div>
      </main>
    )
  }

  // Authenticated user view
  if (user) {
    return (
      <main className="auth-root-container">
        <LoggedInView user={user} onLogout={handleLogout} />
      </main>
    )
  }

  // Step heading texts
  const stepHeadings = {
    phone: isLinkingSocialAccount
      ? {
          title: 'Liên kết số điện thoại',
          subtitle: 'Xác minh số điện thoại để hoàn tất tài khoản Lambe',
        }
      : {
          title: 'Đăng nhập hoặc Đăng ký',
          subtitle: 'Chọn phương thức phù hợp để tiếp tục',
        },
    otp: {
      title: 'Nhập mã xác thực OTP',
      subtitle: `Mã gồm 6 chữ số đã được gửi đến ${formatInternationalPhone(
        submittedPhone,
      )}`,
    },
    profile: {
      title: 'Tạo tài khoản mới',
      subtitle: 'Vui lòng nhập họ tên để hoàn tất thông tin',
    },
  }

  return (
    <div className="auth-screen-wrapper">
      {/* Top Header Bar */}
      <header className="auth-top-header">
        <div className="auth-top-header__inner">
          <button
            type="button"
            className="auth-back-btn"
            aria-label="Quay lại"
            onClick={handleHeaderBack}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="auth-main">
        <div className="auth-card-wrapper">
          {/* Brand Showcase Area */}
          <BrandShowcase
            title={stepHeadings[step].title}
            subtitle={stepHeadings[step].subtitle}
          />

          {/* Main Interaction Card */}
          <div className="auth-interaction-card">
            <div id="firebase-recaptcha-container" />
            {step === 'phone' && (
              <PhoneStep
                phone={phone}
                onPhoneChange={setPhone}
                onSubmit={handlePhoneSubmit}
                isPending={pendingAction === 'send'}
                isSocialPending={
                  pendingAction === 'google' || pendingAction === 'facebook'
                }
                isLinkingSocialAccount={isLinkingSocialAccount}
                onGoogleSignIn={() => void handleSocialSignIn('google')}
                onFacebookSignIn={() => void handleSocialSignIn('facebook')}
                error={error}
                message={message}
              />
            )}

            {step === 'otp' && (
              <OtpStep
                phone={formatInternationalPhone(submittedPhone)}
                otpCode={otpCode}
                onOtpCodeChange={setOtpCode}
                onSubmit={handleOtpSubmit}
                onResend={() => void sendOtp(true)}
                onBack={goBackToPhone}
                isPending={pendingAction === 'verify' || pendingAction === 'resend'}
                cooldown={cooldown}
                error={error}
                message={message}
              />
            )}

            {step === 'profile' && (
              <ProfileStep
                fullName={fullName}
                onFullNameChange={setFullName}
                onSubmit={handleProfileSubmit}
                isPending={pendingAction === 'register'}
                error={error}
                message={message}
              />
            )}
          </div>

          {/* Footer Legal Microcopy */}
          <footer className="auth-footer">
            <p className="auth-footer__text">
              Dịch vụ làm đẹp tận nơi chuyên nghiệp · Lambe Booking
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}

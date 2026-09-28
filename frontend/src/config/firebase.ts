import { getApp, getApps, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  getAuth,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const requiredConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.appId,
]

if (requiredConfig.some((value) => !value)) {
  throw new Error('Thiếu cấu hình Firebase cho ứng dụng web.')
}

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const firebaseAuth = getAuth(firebaseApp)
firebaseAuth.languageCode = 'vi'

const useTestPhoneNumbers =
  import.meta.env.DEV &&
  import.meta.env.VITE_FIREBASE_USE_TEST_PHONE_NUMBERS === 'true'

if (useTestPhoneNumbers) {
  firebaseAuth.settings.appVerificationDisabledForTesting = true
}

const emulatorUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL

if (emulatorUrl && !firebaseAuth.emulatorConfig) {
  connectAuthEmulator(firebaseAuth, emulatorUrl, { disableWarnings: true })
}

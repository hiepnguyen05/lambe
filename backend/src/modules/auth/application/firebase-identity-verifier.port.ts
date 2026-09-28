export const FIREBASE_IDENTITY_VERIFIER = Symbol('FIREBASE_IDENTITY_VERIFIER');

export const SUPPORTED_FIREBASE_SIGN_IN_PROVIDERS = [
  'phone',
  'google.com',
  'facebook.com',
] as const;

export type SupportedFirebaseSignInProvider =
  (typeof SUPPORTED_FIREBASE_SIGN_IN_PROVIDERS)[number];

export interface VerifiedFirebaseIdentity {
  uid: string;
  signInProvider: SupportedFirebaseSignInProvider;
  phoneNumber?: string;
  email?: string;
  displayName?: string;
}

export interface FirebaseIdentityVerifier {
  verifyIdToken(idToken: string): Promise<VerifiedFirebaseIdentity>;
}

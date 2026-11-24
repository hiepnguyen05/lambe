typedef IdentityTokenCallback = Future<void> Function(String idToken);
typedef IdentityErrorCallback = void Function(Object error, StackTrace stack);

abstract interface class AuthIdentityDataSource {
  Future<void> sendOtp(
    String phone, {
    required bool isLinking,
    required void Function(String verificationId) onCodeSent,
    required IdentityTokenCallback onAutoVerified,
    required IdentityErrorCallback onError,
  });

  Future<String> verifyOtp(
    String verificationId,
    String smsCode, {
    required bool isLinking,
  });

  Future<String?> signInWithGoogle();
  Future<String?> signInWithFacebook();
  Future<void> signOut();
}

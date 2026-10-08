sealed class AuthFlowException implements Exception {
  const AuthFlowException();
}

class RegistrationRequiredException extends AuthFlowException {
  final String registrationToken;

  const RegistrationRequiredException(this.registrationToken);

  @override
  String toString() => 'Cần hoàn tất thông tin đăng ký.';
}

class PhoneVerificationRequiredException extends AuthFlowException {
  const PhoneVerificationRequiredException();

  @override
  String toString() => 'Cần xác minh số điện thoại.';
}

class AuthenticationFailure extends AuthFlowException {
  final String message;

  const AuthenticationFailure(this.message);

  @override
  String toString() => message;
}

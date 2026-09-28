import '../entities/user_entity.dart';

class VerifyOtpResult {
  final bool isNewUser;
  final String? accessToken;
  final UserEntity? user;
  final String? registrationToken;
  final String? phone;

  const VerifyOtpResult({
    required this.isNewUser,
    this.accessToken,
    this.user,
    this.registrationToken,
    this.phone,
  });
}

abstract class AuthRepository {
  Future<void> sendOtp(String phone);
  Future<VerifyOtpResult> verifyOtp(String phone, String code);
  Future<UserEntity> completeRegistration(String registrationToken, String fullName);
  Future<UserEntity?> getCurrentUser();
}

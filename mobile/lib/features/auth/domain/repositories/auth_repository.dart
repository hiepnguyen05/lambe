import '../../../../core/domain/value_objects/upload_payload.dart';
import '../entities/user_entity.dart';

typedef PhoneCodeSent = void Function(String verificationId);
typedef PhoneVerificationCompleted = void Function(UserEntity user);
typedef PhoneVerificationFailed = void Function(
  Object error,
  StackTrace stackTrace,
);

abstract class AuthRepository {
  Future<UserEntity?> getCurrentUser();

  Future<void> sendOtp(
    String phone, {
    required bool isLinking,
    required PhoneCodeSent onCodeSent,
    required PhoneVerificationCompleted onAutoVerified,
    required PhoneVerificationFailed onError,
  });

  Future<UserEntity> verifyOtp(
    String verificationId,
    String smsCode, {
    required bool isLinking,
  });

  Future<UserEntity?> loginWithGoogle();
  Future<UserEntity?> loginWithFacebook();
  Future<UserEntity> loginWithFirebase(String idToken);
  Future<UserEntity> completeRegistration(
    String registrationToken,
    String fullName,
  );
  Future<void> logout();
  Future<UserEntity> updateProfile({String? fullName, String? gender});
  Future<UserEntity> uploadAvatar(UploadPayload upload);
}

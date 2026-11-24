import 'package:mobile/core/network/upload_payload.dart';

abstract interface class AuthRemoteDataSource {
  Future<Map<String, dynamic>> loginWithFirebase(String idToken);
  Future<Map<String, dynamic>> completeRegistration(
    String registrationToken,
    String fullName,
  );
  Future<Map<String, dynamic>> getCurrentUser();
  Future<Map<String, dynamic>> updateCurrentUser(Map<String, dynamic> data);
  Future<Map<String, dynamic>> uploadAvatar(UploadPayload upload);
  Future<void> logout(String refreshToken);
}

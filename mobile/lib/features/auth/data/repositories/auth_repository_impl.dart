import '../../../../core/domain/value_objects/upload_payload.dart';
import '../../../../core/error/app_failure.dart';
import '../../../../core/storage/token_storage.dart';
import '../models/user_model.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/exceptions/auth_flow_exception.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_identity_datasource.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final AuthIdentityDataSource identityDataSource;
  final TokenStorage secureStorage;

  AuthRepositoryImpl(
    this.remoteDataSource,
    this.identityDataSource,
    this.secureStorage,
  );

  @override
  Future<UserEntity?> getCurrentUser() async {
    final token = await secureStorage.getAccessToken();
    if (token == null) return null;

    try {
      final data = await remoteDataSource.getCurrentUser();
      return UserModel.fromJson(Map<String, dynamic>.from(data['user'] as Map))
          .toEntity();
    } on UnauthorizedFailure {
      await secureStorage.clearAll();
      return null;
    }
  }

  @override
  Future<void> sendOtp(
    String phone, {
    required bool isLinking,
    required PhoneCodeSent onCodeSent,
    required PhoneVerificationCompleted onAutoVerified,
    required PhoneVerificationFailed onError,
  }) {
    return identityDataSource.sendOtp(
      phone,
      isLinking: isLinking,
      onCodeSent: onCodeSent,
      onAutoVerified: (idToken) async {
        try {
          onAutoVerified(await loginWithFirebase(idToken));
        } catch (error, stack) {
          onError(error, stack);
        }
      },
      onError: onError,
    );
  }

  @override
  Future<UserEntity> verifyOtp(
    String verificationId,
    String smsCode, {
    required bool isLinking,
  }) async {
    final idToken = await identityDataSource.verifyOtp(
      verificationId,
      smsCode,
      isLinking: isLinking,
    );
    return loginWithFirebase(idToken);
  }

  @override
  Future<UserEntity?> loginWithGoogle() async {
    final idToken = await identityDataSource.signInWithGoogle();
    return idToken == null ? null : loginWithFirebase(idToken);
  }

  @override
  Future<UserEntity?> loginWithFacebook() async {
    final idToken = await identityDataSource.signInWithFacebook();
    return idToken == null ? null : loginWithFirebase(idToken);
  }

  @override
  Future<UserEntity> loginWithFirebase(String idToken) async {
    final data = await remoteDataSource.loginWithFirebase(idToken);

    if (data.containsKey('registrationToken')) {
      throw RegistrationRequiredException(data['registrationToken'] as String);
    }
    if (data['requiresPhoneVerification'] == true) {
      throw const PhoneVerificationRequiredException();
    }

    final token = data['accessToken'] as String;
    final userJson = data['user'] as Map<String, dynamic>;
    await secureStorage.saveAccessToken(token);
    return UserModel.fromJson(userJson).toEntity();
  }

  @override
  Future<UserEntity> completeRegistration(
    String registrationToken,
    String fullName,
  ) async {
    final data = await remoteDataSource.completeRegistration(
      registrationToken,
      fullName,
    );
    final token = data['accessToken'] as String;
    final userJson = data['user'] as Map<String, dynamic>;
    await secureStorage.saveAccessToken(token);
    return UserModel.fromJson(userJson).toEntity();
  }

  @override
  Future<void> logout() async {
    try {
      await identityDataSource.signOut();
    } finally {
      await secureStorage.clearAll();
    }
  }

  @override
  Future<UserEntity> updateProfile({String? fullName, String? gender}) async {
    final data = <String, dynamic>{};
    if (fullName != null) data['fullName'] = fullName;
    if (gender != null) data['gender'] = gender;

    final result = await remoteDataSource.updateCurrentUser(data);
    return UserModel.fromJson(Map<String, dynamic>.from(result['user'] as Map))
        .toEntity();
  }

  @override
  Future<UserEntity> uploadAvatar(UploadPayload upload) async {
    final result = await remoteDataSource.uploadAvatar(upload);
    return UserModel.fromJson(Map<String, dynamic>.from(result['user'] as Map))
        .toEntity();
  }
}

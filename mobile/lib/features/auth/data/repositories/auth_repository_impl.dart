import '../../../../core/storage/secure_storage_service.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remoteDataSource;
  final SecureStorageService _storageService;

  AuthRepositoryImpl(this._remoteDataSource, this._storageService);

  @override
  Future<void> sendOtp(String phone) async {
    await _remoteDataSource.sendOtp(phone);
  }

  @override
  Future<VerifyOtpResult> verifyOtp(String phone, String code) async {
    final result = await _remoteDataSource.verifyOtp(phone, code);
    if (!result.isNewUser && result.accessToken != null && result.user != null) {
      await _storageService.saveAccessToken(result.accessToken!);
      await _storageService.saveUserSession(
        userId: result.user!.id,
        phone: result.user!.phone,
      );
    }
    return result;
  }

  @override
  Future<UserEntity> completeRegistration(String registrationToken, String fullName) async {
    final data = await _remoteDataSource.completeRegistration(registrationToken, fullName);
    final accessToken = data['accessToken'] as String;
    final userData = data['user'] as Map<String, dynamic>;

    final rolesList = (userData['roles'] as List?)?.map((e) => e.toString()).toList() ?? ['CUSTOMER'];
    final user = UserEntity(
      id: userData['id'] as String,
      phone: userData['phone'] as String,
      fullName: userData['fullName'] as String?,
      roles: rolesList,
      status: userData['status'] as String? ?? 'ACTIVE',
    );

    await _storageService.saveAccessToken(accessToken);
    await _storageService.saveUserSession(userId: user.id, phone: user.phone);

    return user;
  }

  @override
  Future<UserEntity?> getCurrentUser() async {
    final token = await _storageService.getAccessToken();
    if (token == null || token.isEmpty) return null;
    return await _remoteDataSource.getCurrentUser();
  }
}

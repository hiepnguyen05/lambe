import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/upload_payload.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/shared/auth/data/datasources/auth_identity_datasource.dart';
import 'package:mobile/features/shared/auth/data/datasources/auth_remote_datasource.dart';
import 'package:mobile/features/shared/auth/data/repositories/auth_repository_impl.dart';

void main() {
  test('loginWithGoogle delegates to remote login and persists accessToken and refreshToken', () async {
    final remote = _FakeAuthRemoteDataSource();
    final identity = _FakeAuthIdentityDataSource(googleToken: 'google-token');
    final storage = _FakeTokenStorage();
    final repository = AuthRepositoryImpl(remote, identity, storage);

    final user = await repository.loginWithGoogle();

    expect(user?.id, 'user-1');
    expect(remote.lastFirebaseToken, 'google-token');
    expect(storage.token, 'access-token');
    expect(storage.refreshToken, 'refresh-token-123');
  });

  test(
    'logout revokes refresh token on remote and clears local storage',
    () async {
      final remote = _FakeAuthRemoteDataSource();
      final identity = _FakeAuthIdentityDataSource();
      final storage = _FakeTokenStorage()
        ..token = 'access-token'
        ..refreshToken = 'refresh-token-xyz';
      final repository = AuthRepositoryImpl(remote, identity, storage);

      await repository.logout();

      expect(remote.lastLoggedOutRefreshToken, 'refresh-token-xyz');
      expect(storage.token, isNull);
      expect(storage.refreshToken, isNull);
      expect(storage.clearCount, 1);
    },
  );

  test('getCurrentUser clears tokens on unauthorized error', () async {
    final remote = _FakeAuthRemoteDataSource(throwUnauthorized: true);
    final identity = _FakeAuthIdentityDataSource();
    final storage = _FakeTokenStorage()..token = 'stale-token';
    final repository = AuthRepositoryImpl(remote, identity, storage);

    final user = await repository.getCurrentUser();

    expect(user, isNull);
    expect(storage.clearCount, 1);
  });
}

class _FakeAuthRemoteDataSource implements AuthRemoteDataSource {
  final bool throwUnauthorized;
  String? lastFirebaseToken;
  String? lastLoggedOutRefreshToken;

  _FakeAuthRemoteDataSource({this.throwUnauthorized = false});

  Map<String, dynamic> get _session => {
    'accessToken': 'access-token',
    'refreshToken': 'refresh-token-123',
    'user': {'id': 'user-1', 'fullName': 'Lambe User'},
  };

  @override
  Future<Map<String, dynamic>> loginWithFirebase(String idToken) async {
    lastFirebaseToken = idToken;
    return _session;
  }

  @override
  Future<Map<String, dynamic>> completeRegistration(
    String registrationToken,
    String fullName,
  ) async => _session;

  @override
  Future<Map<String, dynamic>> getCurrentUser() async {
    if (throwUnauthorized) throw const UnauthorizedFailure();
    return {
      'user': {'id': 'user-1'},
    };
  }

  @override
  Future<Map<String, dynamic>> updateCurrentUser(
    Map<String, dynamic> data,
  ) async => {
    'user': {'id': 'user-1', ...data},
  };

  @override
  Future<Map<String, dynamic>> uploadAvatar(UploadPayload upload) async => {
    'user': {'id': 'user-1', 'avatarUrl': upload.fileName},
  };

  @override
  Future<void> logout(String refreshToken) async {
    lastLoggedOutRefreshToken = refreshToken;
  }
}

class _FakeAuthIdentityDataSource implements AuthIdentityDataSource {
  final String? googleToken;

  _FakeAuthIdentityDataSource({this.googleToken});

  @override
  Future<String?> signInWithGoogle() async => googleToken;

  @override
  Future<String?> signInWithFacebook() async => null;

  @override
  Future<void> sendOtp(
    String phone, {
    required bool isLinking,
    required void Function(String verificationId) onCodeSent,
    required IdentityTokenCallback onAutoVerified,
    required IdentityErrorCallback onError,
  }) async {}

  @override
  Future<String> verifyOtp(
    String verificationId,
    String smsCode, {
    required bool isLinking,
  }) async => 'firebase-token';

  @override
  Future<void> signOut() async {}
}

class _FakeTokenStorage implements SecureStorageService {
  final _appModes = <String, String>{};

  @override
  Future<String?> getAppMode(String userId) async => _appModes[userId];

  @override
  Future<void> saveAppMode(String userId, String mode) async {
    _appModes[userId] = mode;
  }

  @override
  Future<void> deleteAppMode(String userId) async {
    _appModes.remove(userId);
  }

  String? token;
  String? refreshToken;
  int clearCount = 0;

  @override
  Future<String> getInstallationId() async => 'test-installation-id';

  @override
  Future<bool> wasPushPermissionExplained() async => false;

  @override
  Future<void> markPushPermissionExplained() async {}

  @override
  Future<void> saveAccessToken(String token) async => this.token = token;

  @override
  Future<String?> getAccessToken() async => token;

  @override
  Future<void> saveRefreshToken(String token) async => refreshToken = token;

  @override
  Future<String?> getRefreshToken() async => refreshToken;

  @override
  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    token = accessToken;
    this.refreshToken = refreshToken;
  }

  @override
  Future<void> saveUserSession({
    required String userId,
    required String phone,
    List<String>? roles,
  }) async {
    if (roles != null) await saveUserRoles(roles);
  }

  List<String> _roles = [];

  @override
  Future<void> saveUserRoles(List<String> roles) async {
    _roles = List.from(roles);
  }

  @override
  Future<List<String>> getUserRoles() async => _roles;

  @override
  Future<String?> getUserId() async => null;

  @override
  Future<String?> getPhone() async => null;

  @override
  Future<void> clearAll() async {
    token = null;
    refreshToken = null;
    _roles = [];
    _appModes.clear();
    clearCount++;
  }
}

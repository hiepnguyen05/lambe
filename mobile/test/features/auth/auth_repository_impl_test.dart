import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/domain/value_objects/upload_payload.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/storage/token_storage.dart';
import 'package:mobile/features/auth/data/datasources/auth_identity_datasource.dart';
import 'package:mobile/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:mobile/features/auth/data/repositories/auth_repository_impl.dart';

void main() {
  test(
    'exchanges identity token, persists access token, and maps user',
    () async {
      final remote = _FakeAuthRemoteDataSource();
      final storage = _FakeTokenStorage();
      final repository = AuthRepositoryImpl(
        remote,
        _FakeAuthIdentityDataSource(googleToken: 'firebase-token'),
        storage,
      );

      final user = await repository.loginWithGoogle();

      expect(remote.lastFirebaseToken, 'firebase-token');
      expect(storage.token, 'access-token');
      expect(user?.id, 'user-1');
      expect(user?.fullName, 'Lambe User');
    },
  );

  test('clears an expired session when current user returns 401', () async {
    final remote = _FakeAuthRemoteDataSource(throwUnauthorized: true);
    final storage = _FakeTokenStorage()..token = 'expired-token';
    final repository = AuthRepositoryImpl(
      remote,
      _FakeAuthIdentityDataSource(),
      storage,
    );

    final user = await repository.getCurrentUser();

    expect(user, isNull);
    expect(storage.token, isNull);
    expect(storage.clearCount, 1);
  });
}

class _FakeAuthRemoteDataSource implements AuthRemoteDataSource {
  final bool throwUnauthorized;
  String? lastFirebaseToken;

  _FakeAuthRemoteDataSource({this.throwUnauthorized = false});

  Map<String, dynamic> get _session => {
    'accessToken': 'access-token',
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

class _FakeTokenStorage implements TokenStorage {
  String? token;
  int clearCount = 0;

  @override
  Future<void> saveAccessToken(String token) async => this.token = token;

  @override
  Future<String?> getAccessToken() async => token;

  @override
  Future<void> clearAll() async {
    token = null;
    clearCount++;
  }
}

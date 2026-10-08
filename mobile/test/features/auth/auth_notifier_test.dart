import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/domain/value_objects/upload_payload.dart';
import 'package:mobile/features/auth/application/auth_notifier.dart';
import 'package:mobile/features/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/auth/domain/exceptions/auth_flow_exception.dart';
import 'package:mobile/features/auth/domain/repositories/auth_repository.dart';

void main() {
  const user = UserEntity(id: 'user-1', fullName: 'Lambe User');

  test('loads the persisted session on initialization', () async {
    final notifier = AuthNotifier(_FakeAuthRepository(currentUser: user));
    addTearDown(notifier.dispose);

    await _flushAsyncWork();

    expect(notifier.state.value, user);
  });

  test('keeps verification id from sendOtp for verifyOtp', () async {
    final repository = _FakeAuthRepository(currentUser: null, otpUser: user);
    final notifier = AuthNotifier(repository);
    addTearDown(notifier.dispose);
    await _flushAsyncWork();

    var codeSent = false;
    await notifier.sendOtp('0900000000', onCodeSent: () => codeSent = true);
    await notifier.verifyOtp('123456');

    expect(codeSent, isTrue);
    expect(repository.lastVerificationId, 'verification-1');
    expect(repository.lastSmsCode, '123456');
    expect(notifier.state.value, user);
  });

  test('reports a typed failure when OTP session is missing', () async {
    final notifier = AuthNotifier(_FakeAuthRepository(currentUser: null));
    addTearDown(notifier.dispose);
    await _flushAsyncWork();

    await notifier.verifyOtp('123456');

    expect(notifier.state.error, isA<AuthenticationFailure>());
  });

  test('treats a cancelled social login as an unauthenticated state', () async {
    final notifier = AuthNotifier(
      _FakeAuthRepository(currentUser: null, socialUser: null),
    );
    addTearDown(notifier.dispose);
    await _flushAsyncWork();

    await notifier.loginWithGoogle();

    expect(notifier.state.error, isNull);
    expect(notifier.state.value, isNull);
  });
}

Future<void> _flushAsyncWork() => Future<void>.delayed(Duration.zero);

class _FakeAuthRepository implements AuthRepository {
  final UserEntity? currentUser;
  final UserEntity? otpUser;
  final UserEntity? socialUser;

  String? lastVerificationId;
  String? lastSmsCode;

  _FakeAuthRepository({
    required this.currentUser,
    this.otpUser,
    this.socialUser,
  });

  @override
  Future<UserEntity?> getCurrentUser() async => currentUser;

  @override
  Future<void> sendOtp(
    String phone, {
    required bool isLinking,
    required PhoneCodeSent onCodeSent,
    required PhoneVerificationCompleted onAutoVerified,
    required PhoneVerificationFailed onError,
  }) async {
    onCodeSent('verification-1');
  }

  @override
  Future<UserEntity> verifyOtp(
    String verificationId,
    String smsCode, {
    required bool isLinking,
  }) async {
    lastVerificationId = verificationId;
    lastSmsCode = smsCode;
    return otpUser ?? const UserEntity(id: 'otp-user');
  }

  @override
  Future<UserEntity?> loginWithGoogle() async => socialUser;

  @override
  Future<UserEntity?> loginWithFacebook() async => socialUser;

  @override
  Future<UserEntity> loginWithFirebase(String idToken) async =>
      otpUser ?? const UserEntity(id: 'firebase-user');

  @override
  Future<UserEntity> completeRegistration(
    String registrationToken,
    String fullName,
  ) async => UserEntity(id: 'registered-user', fullName: fullName);

  @override
  Future<void> logout() async {}

  @override
  Future<UserEntity> updateProfile({String? fullName, String? gender}) async =>
      UserEntity(id: 'user-1', fullName: fullName, gender: gender);

  @override
  Future<UserEntity> uploadAvatar(UploadPayload upload) async =>
      const UserEntity(id: 'user-1');
}

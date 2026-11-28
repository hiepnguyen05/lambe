import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/upload_payload.dart';

import '../domain/entities/user_entity.dart';
import '../domain/exceptions/auth_flow_exception.dart';
import '../domain/repositories/auth_repository.dart';

class AuthNotifier extends StateNotifier<AsyncValue<UserEntity?>> {
  final AuthRepository _repository;
  String? _verificationId;
  Future<void>? _activeLoadFuture;

  AuthNotifier(this._repository) : super(const AsyncValue.loading()) {
    _activeLoadFuture = _loadSession();
  }

  Future<void> _loadSession() async {
    try {
      final user = await _repository.getCurrentUser();
      if (mounted) state = AsyncValue.data(user);
    } catch (error, stack) {
      if (mounted) state = AsyncValue.error(error, stack);
    } finally {
      _activeLoadFuture = null;
    }
  }

  Future<void> refreshSession({bool force = false}) async {
    final active = _activeLoadFuture;
    if (!force && active != null) {
      await active;
      return;
    }
    state = const AsyncValue.loading();
    _activeLoadFuture = _loadSession();
    await _activeLoadFuture;
  }

  Future<void> sendOtp(
    String phone, {
    required void Function() onCodeSent,
    bool isLinking = false,
  }) async {
    state = const AsyncValue.loading();
    try {
      await _repository.sendOtp(
        phone,
        isLinking: isLinking,
        onCodeSent: (verificationId) {
          _verificationId = verificationId;
          if (mounted) state = const AsyncValue.data(null);
          onCodeSent();
        },
        onAutoVerified: (user) {
          if (mounted) state = AsyncValue.data(user);
        },
        onError: (error, stack) {
          if (mounted) state = AsyncValue.error(error, stack);
        },
      );
    } catch (error, stack) {
      if (mounted) state = AsyncValue.error(error, stack);
    }
  }

  Future<void> verifyOtp(String smsCode, {bool isLinking = false}) async {
    final verificationId = _verificationId;
    if (verificationId == null) {
      state = AsyncValue.error(
        const AuthenticationFailure('Phiên xác thực OTP không còn hiệu lực.'),
        StackTrace.current,
      );
      return;
    }

    await _runUserAction(
      () =>
          _repository.verifyOtp(verificationId, smsCode, isLinking: isLinking),
    );
  }

  Future<void> loginWithGoogle() async {
    await _runOptionalUserAction(_repository.loginWithGoogle);
  }

  Future<void> loginWithFacebook() async {
    await _runOptionalUserAction(_repository.loginWithFacebook);
  }

  Future<void> loginWithFirebase(String idToken) async {
    await _runUserAction(() => _repository.loginWithFirebase(idToken));
  }

  Future<void> completeRegistration(
    String registrationToken,
    String fullName,
  ) async {
    await _runUserAction(
      () => _repository.completeRegistration(registrationToken, fullName),
    );
  }

  Future<void> logout() async {
    state = const AsyncValue<UserEntity?>.loading().copyWithPrevious(state);
    try {
      await _repository.logout();
    } catch (error, stack) {
      debugPrint('⚠️ [AuthNotifier] Logout failed: $error\n$stack');
    } finally {
      if (mounted) state = const AsyncValue.data(null);
    }
  }

  void expireSession() {
    if (mounted) state = const AsyncValue.data(null);
  }

  void updateOnboardingStatus(String status) {
    final user = state.valueOrNull;
    if (user != null) {
      state = AsyncValue.data(user.copyWith(onboardingStatus: status));
    }
  }

  Future<void> updateProfile({String? fullName, String? gender}) async {
    await _runUserAction(
      () => _repository.updateProfile(fullName: fullName, gender: gender),
    );
  }

  Future<void> uploadAvatar(UploadPayload upload) async {
    await _runUserAction(() => _repository.uploadAvatar(upload));
  }

  Future<void> _runUserAction(Future<UserEntity> Function() action) async {
    final previous = state.valueOrNull != null ? state : null;
    var loading = const AsyncValue<UserEntity?>.loading();
    if (previous != null) loading = loading.copyWithPrevious(previous);
    state = loading;
    try {
      final user = await action();
      if (mounted) state = AsyncValue.data(user);
    } catch (error, stack) {
      if (mounted) {
        var failure = AsyncValue<UserEntity?>.error(error, stack);
        if (previous != null) failure = failure.copyWithPrevious(previous);
        state = failure;
      }
    }
  }

  Future<void> _runOptionalUserAction(
    Future<UserEntity?> Function() action,
  ) async {
    final previous = state.valueOrNull != null ? state : null;
    var loading = const AsyncValue<UserEntity?>.loading();
    if (previous != null) loading = loading.copyWithPrevious(previous);
    state = loading;
    try {
      final user = await action();
      if (mounted) state = AsyncValue.data(user);
    } catch (error, stack) {
      if (mounted) {
        var failure = AsyncValue<UserEntity?>.error(error, stack);
        if (previous != null) failure = failure.copyWithPrevious(previous);
        state = failure;
      }
    }
  }
}

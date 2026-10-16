import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/location/user_location_provider.dart';
import '../../../address/di/address_providers.dart';
import '../../../auth/di/auth_providers.dart';
import '../../../auth/domain/entities/user_entity.dart';
import '../../domain/entities/splash_step.dart';
import '../../domain/entities/splash_target_route.dart';

class SplashState {
  final SplashStep step;
  final String statusMessage;
  final IconData statusIcon;
  final double progress;
  final SplashTargetRoute? targetRoute;
  final bool hasError;
  final String? errorMessage;

  const SplashState({
    this.step = SplashStep.initializing,
    this.statusMessage = 'Đang khởi tạo ứng dụng...',
    this.statusIcon = Icons.cloud_sync_rounded,
    this.progress = 0.15,
    this.targetRoute,
    this.hasError = false,
    this.errorMessage,
  });

  SplashState copyWith({
    SplashStep? step,
    String? statusMessage,
    IconData? statusIcon,
    double? progress,
    SplashTargetRoute? targetRoute,
    bool? hasError,
    String? errorMessage,
  }) {
    return SplashState(
      step: step ?? this.step,
      statusMessage: statusMessage ?? this.statusMessage,
      statusIcon: statusIcon ?? this.statusIcon,
      progress: progress ?? this.progress,
      targetRoute: targetRoute ?? this.targetRoute,
      hasError: hasError ?? this.hasError,
      errorMessage: errorMessage ?? this.errorMessage,
    );
  }
}

class SplashNotifier extends StateNotifier<SplashState> {
  final Ref _ref;

  SplashNotifier(this._ref) : super(const SplashState());

  /// Thực thi toàn bộ chuỗi khởi tạo hệ thống (Auth -> Location -> Role Resolution)
  Future<void> bootstrap({Duration minSplashDuration = const Duration(milliseconds: 1200)}) async {
    state = const SplashState(
      step: SplashStep.initializing,
      statusMessage: 'Đang kết nối hệ thống LamBe...',
      statusIcon: Icons.cloud_sync_rounded,
      progress: 0.20,
    );

    final stopwatch = Stopwatch()..start();

    try {
      await Future.delayed(const Duration(milliseconds: 350));

      // 1. Kiểm tra xác thực phiên & thông tin người dùng
      state = state.copyWith(
        step: SplashStep.checkingAuth,
        statusMessage: SplashStep.checkingAuth.message,
        statusIcon: SplashStep.checkingAuth.icon,
        progress: SplashStep.checkingAuth.progress,
      );

      UserEntity? user;
      try {
        await _ref.read(authNotifierProvider.notifier).refreshSession();
        user = _ref.read(authNotifierProvider).valueOrNull;
      } catch (authError) {
        debugPrint('⚠️ [SplashNotifier] Lỗi xác thực phiên: $authError');
      }

      // 2. Lấy vị trí GPS thực tế & dịch địa chỉ
      state = state.copyWith(
        step: SplashStep.fetchingLocation,
        statusMessage: SplashStep.fetchingLocation.message,
        statusIcon: SplashStep.fetchingLocation.icon,
        progress: SplashStep.fetchingLocation.progress,
      );

      try {
        await _ref.read(userLocationProvider.notifier).fetchLocation(
              timeout: const Duration(seconds: 4),
            );
      } catch (locError) {
        debugPrint('⚠️ [SplashNotifier] Lỗi lấy vị trí GPS: $locError');
      }

      // Nếu là khách hàng, tải trước danh sách địa chỉ đã lưu trong nền
      if (user != null && !user.roles.contains('PROVIDER')) {
        try {
          _ref.read(addressNotifierProvider.notifier).fetchAddresses();
        } catch (_) {}
      }

      // 3. Phân định vai trò và chuẩn bị không gian làm việc
      final isProvider = user != null && user.roles.contains('PROVIDER');
      final SplashTargetRoute destination;

      if (user == null) {
        destination = SplashTargetRoute.auth;
      } else {
        final hasFinishedOnboarding =
            user.onboardingStatus == 'COMPLETED' ||
            user.onboardingStatus == 'SKIPPED';

        if (!hasFinishedOnboarding) {
          destination = SplashTargetRoute.onboarding;
        } else if (isProvider) {
          destination = SplashTargetRoute.providerHome;
        } else {
          destination = SplashTargetRoute.customerHome;
        }
      }

      String readyMessage;
      IconData readyIcon;

      if (user == null) {
        readyMessage = 'Chào mừng bạn đến với LamBe!';
        readyIcon = Icons.spa_rounded;
      } else if (isProvider) {
        readyMessage = 'Đang mở không gian Chuyên viên Đối tác...';
        readyIcon = Icons.business_center_rounded;
      } else {
        readyMessage = 'Đang mở không gian Khách hàng...';
        readyIcon = Icons.home_rounded;
      }

      state = state.copyWith(
        step: SplashStep.preparingWorkspace,
        statusMessage: readyMessage,
        statusIcon: readyIcon,
        progress: 1.0,
      );

      // Đảm bảo thời gian chiêm ngưỡng tối thiểu để tạo cảm giác mượt mà
      final elapsed = stopwatch.elapsedMilliseconds;
      if (elapsed < minSplashDuration.inMilliseconds) {
        await Future.delayed(
          Duration(milliseconds: minSplashDuration.inMilliseconds - elapsed),
        );
      }

      // Hoàn tất, sẵn sàng kích hoạt điều hướng
      state = state.copyWith(
        step: SplashStep.completed,
        targetRoute: destination,
      );
    } catch (e) {
      debugPrint('❌ [SplashNotifier] Lỗi khởi động: $e');
      state = state.copyWith(
        step: SplashStep.completed,
        targetRoute: SplashTargetRoute.auth,
      );
    }
  }
}

final splashNotifierProvider =
    StateNotifierProvider.autoDispose<SplashNotifier, SplashState>((ref) {
  return SplashNotifier(ref);
});

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/routing/app_mode.dart';
import 'package:mobile/core/routing/app_mode_provider.dart';
import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/shared/address/di/address_providers.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';

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
  Future<void> bootstrap({
    Duration minSplashDuration = const Duration(milliseconds: 400),
  }) async {
    state = const SplashState(
      step: SplashStep.initializing,
      statusMessage: 'Đang kết nối hệ thống LamBe...',
      statusIcon: Icons.cloud_sync_rounded,
      progress: 0.20,
    );

    final stopwatch = Stopwatch()..start();

    try {
      UserEntity? user;
      bool isNetworkFailure = false;

      // 1 & 2. Chạy song song xác thực phiên & lấy vị trí GPS thay vì đợi tuần tự
      await Future.wait([
        (() async {
          try {
            await _ref.read(authNotifierProvider.notifier).refreshSession();
            user = _ref.read(authNotifierProvider).valueOrNull;
            final authState = _ref.read(authNotifierProvider);
            if (authState.hasError && authState.error is NetworkFailure) {
              isNetworkFailure = true;
            }
          } catch (authError) {
            debugPrint('⚠️ [SplashNotifier] Lỗi xác thực phiên: $authError');
          }
        })(),
        (() async {
          try {
            await _ref
                .read(userLocationProvider.notifier)
                .fetchLocation(timeout: const Duration(seconds: 3));
          } catch (locError) {
            debugPrint('⚠️ [SplashNotifier] Lỗi lấy vị trí GPS: $locError');
          }
        })(),
      ]);

      final currentUser = user;
      if (!mounted) return;

      final secureStorage = _ref.read(secureStorageProvider);
      final storedToken = await secureStorage.getAccessToken();
      final hasStoredToken = storedToken != null && storedToken.isNotEmpty;

      // Nếu là khách hàng, tải trước danh sách địa chỉ đã lưu trong nền
      if (currentUser != null && !currentUser.roles.contains('PROVIDER')) {
        try {
          _ref.read(addressNotifierProvider.notifier).fetchAddresses();
        } catch (addrError) {
          debugPrint('⚠️ [SplashNotifier] Prefetching addresses failed: $addrError');
        }
      }

      // 3. Phân định vai trò và chuẩn bị không gian làm việc
      final SplashTargetRoute destination;

      if (currentUser == null) {
        if (hasStoredToken && isNetworkFailure) {
          // Người dùng có token nhưng gặp lỗi kết nối: dùng vai trò đã lưu để mở đúng không gian
          final savedRoles = await secureStorage.getUserRoles();
          final savedUserId = await secureStorage.getUserId() ?? '';
          final savedMode = await secureStorage.getAppMode(savedUserId);
          final isSavedProvider =
              savedRoles.contains('PROVIDER') &&
              (savedMode == AppMode.provider.name || savedMode == null);
          destination = isSavedProvider
              ? SplashTargetRoute.providerHome
              : SplashTargetRoute.customerHome;
        } else {
          destination = SplashTargetRoute.auth;
        }
      } else {
        final mode = await _ref.read(appModeProvider(currentUser.id).future);
        final route = signedInLandingRoute(currentUser, mode);
        destination = SplashTargetRoute.values.firstWhere(
          (value) => value.path == route,
        );
      }

      String readyMessage;
      IconData readyIcon;

      if (currentUser == null) {
        if (hasStoredToken &&
            isNetworkFailure &&
            destination == SplashTargetRoute.providerHome) {
          readyMessage =
              'Đang mở không gian Chuyên viên Đối tác (ngoại tuyến)...';
          readyIcon = Icons.business_center_rounded;
        } else if (hasStoredToken && isNetworkFailure) {
          readyMessage = 'Đang mở không gian Khách hàng (ngoại tuyến)...';
          readyIcon = Icons.home_rounded;
        } else {
          readyMessage = 'Chào mừng bạn đến với LamBe!';
          readyIcon = Icons.spa_rounded;
        }
      } else if (destination == SplashTargetRoute.providerHome) {
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

      if (!mounted) return;

      // Hoàn tất, sẵn sàng kích hoạt điều hướng
      state = state.copyWith(
        step: SplashStep.completed,
        targetRoute: destination,
      );
    } catch (e) {
      debugPrint('❌ [SplashNotifier] Lỗi khởi động: $e');
      if (!mounted) return;
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

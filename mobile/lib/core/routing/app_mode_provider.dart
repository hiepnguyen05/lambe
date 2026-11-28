import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import 'app_mode.dart';

final appModeProvider = FutureProvider.family<AppMode, String>((
  ref,
  userId,
) async {
  ref.listen(authNotifierProvider, (_, next) {
    if (!next.isLoading && !next.hasError && next.valueOrNull?.id != userId) {
      ref.invalidateSelf();
    }
  });
  final storage = ref.watch(secureStorageProvider);
  final saved = await storage.getAppMode(userId);
  if (saved != null) {
    return saved == AppMode.provider.name ? AppMode.provider : AppMode.customer;
  }

  // Nếu chưa có thiết lập lưu trước đó (đăng nhập lần đầu / mới cài đặt):
  // Ưu tiên chuyển vào chế độ Provider nếu tài khoản có vai trò PROVIDER
  final user = ref.watch(authNotifierProvider).valueOrNull;
  if (user != null && user.id == userId && user.roles.contains('PROVIDER')) {
    try {
      await storage.saveAppMode(userId, AppMode.provider.name);
    } catch (error) {
      debugPrint('[AppMode] Unable to persist initial provider mode: $error');
    }
    return AppMode.provider;
  }

  final savedRoles = await storage.getUserRoles();
  if (savedRoles.contains('PROVIDER')) {
    try {
      await storage.saveAppMode(userId, AppMode.provider.name);
    } catch (error) {
      debugPrint('[AppMode] Unable to persist role-based provider mode: $error');
    }
    return AppMode.provider;
  }

  return AppMode.customer;
});

final appModeControllerProvider = Provider(AppModeController.new);

class AppModeController {
  final Ref _ref;

  AppModeController(this._ref);

  Future<void> switchMode(AppMode mode) async {
    final user = _ref.read(authNotifierProvider).valueOrNull;
    if (user == null ||
        (mode == AppMode.provider && !user.roles.contains('PROVIDER'))) {
      throw StateError('Tài khoản không thể sử dụng chế độ này.');
    }
    final storage = _ref.read(secureStorageProvider);
    await storage.saveAppMode(user.id, mode.name);
    final current = _ref.read(authNotifierProvider).valueOrNull;
    if (current?.id != user.id ||
        (mode == AppMode.provider && !current!.roles.contains('PROVIDER'))) {
      await storage.deleteAppMode(user.id);
      _ref.invalidate(appModeProvider(user.id));
      throw StateError('Phiên đăng nhập đã thay đổi.');
    }
    _ref.invalidate(appModeProvider(user.id));
  }
}

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/dio_client.dart';

import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import '../../data/datasources/provider_notifications_remote_datasource.dart';
import '../../data/repositories/notifications_repository_impl.dart';
import '../../domain/entities/app_notification_entity.dart';
import '../../domain/repositories/notifications_repository.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>((
  ref,
) {
  final user = ref.watch(
    authNotifierProvider.select((state) => state.valueOrNull),
  );
  final dio = ref.watch(dioProvider);
  return NotificationsRepositoryImpl(
    orderDataSource: ref.watch(orderNotificationsRemoteDataSourceProvider),
    dio: dio,
    providerDataSource: user?.roles.contains('PROVIDER') == true
        ? ProviderNotificationsRemoteDataSource(dio)
        : null,
  );
});

final selectedNotificationCategoryProvider =
    StateProvider<NotificationCategory>((ref) => NotificationCategory.all);

class NotificationsNotifier
    extends StateNotifier<AsyncValue<List<AppNotificationEntity>>> {
  final NotificationsRepository _repo;
  final String _userId;
  final Ref _ref;

  NotificationsNotifier(this._repo, this._userId, this._ref)
    : super(const AsyncValue.loading()) {
    load();
  }

  int _generation = 0;

  Future<void> load() async {
    final generation = ++_generation;
    if (!state.hasValue) state = const AsyncValue.loading();
    try {
      final items = await _repo.getNotifications(userId: _userId);
      if (mounted && generation == _generation) state = AsyncValue.data(items);
    } catch (e, st) {
      if (mounted && generation == _generation) state = AsyncValue.error(e, st);
    }
  }

  Future<void> refresh() => load();

  Future<void> markAsRead(String id) async {
    final matches = state.valueOrNull?.where((notice) => notice.id == id);
    final type = matches?.isNotEmpty == true
        ? (matches!.first.metadata?['entityType'] as String? ?? 'ORDER')
        : 'ORDER';
    await _repo.markAsRead(id, userId: _userId, entityType: type);
    if (!mounted) return;
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncValue.data(
        current.map((n) => n.id == id ? n.copyWith(isRead: true) : n).toList(),
      );
    }
    _ref.invalidate(orderNotificationsProvider(_userId));
  }

  Future<void> markAllAsRead() async {
    await _repo.markAllAsRead(userId: _userId);
    if (mounted) await load();
  }

  Future<String?> resolveDestination(AppNotificationEntity notice) =>
      _repo.resolveDestination(notice);
}

final notificationsNotifierProvider = StateNotifierProvider.autoDispose
    .family<
      NotificationsNotifier,
      AsyncValue<List<AppNotificationEntity>>,
      String
    >((ref, userId) {
      final repo = ref.watch(notificationsRepositoryProvider);
      final notifier = NotificationsNotifier(repo, userId, ref);
      Timer? refreshTimer;
      ref.listen(orderNotificationEventsProvider, (_, next) {
        if (!next.hasValue) return;
        refreshTimer?.cancel();
        refreshTimer = Timer(
          const Duration(milliseconds: 300),
          notifier.refresh,
        );
      });
      ref.onDispose(() => refreshTimer?.cancel());
      return notifier;
    });

/// Danh sách thông báo sau khi lọc theo tab danh mục
final filteredNotificationsProvider =
    Provider.autoDispose<List<AppNotificationEntity>>((ref) {
      final auth = ref.watch(authNotifierProvider);
      final userId = auth.valueOrNull?.id;
      if (userId == null) return const [];

      final asyncList = ref.watch(notificationsNotifierProvider(userId));
      final list = asyncList.valueOrNull ?? const [];
      final selectedCategory = ref.watch(selectedNotificationCategoryProvider);

      if (selectedCategory == NotificationCategory.all) {
        return list;
      }
      return list.where((n) => n.category == selectedCategory).toList();
    });

/// Số lượng thông báo chưa đọc cho từng danh mục
final unreadCountByCategoryProvider = Provider.autoDispose
    .family<int, NotificationCategory>((ref, category) {
      final auth = ref.watch(authNotifierProvider);
      final userId = auth.valueOrNull?.id;
      if (userId == null) return 0;

      final asyncList = ref.watch(notificationsNotifierProvider(userId));
      final list = asyncList.valueOrNull ?? const [];

      if (category == NotificationCategory.all) {
        return list.where((n) => !n.isRead).length;
      }
      return list.where((n) => n.category == category && !n.isRead).length;
    });

/// Tổng số thông báo chưa đọc trên toàn app
final totalUnreadNotificationsCountProvider = Provider.autoDispose<int>((ref) {
  return ref.watch(unreadCountByCategoryProvider(NotificationCategory.all));
});

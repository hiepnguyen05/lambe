import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/datasources/provider_orders_remote_datasource.dart';
import '../di/provider_workspace_providers.dart';
import '../domain/entities/incoming_order_entity.dart';

import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';
import 'package:mobile/features/shared/order_notifications/domain/order_notification.dart';

class ProviderIncomingOrdersNotifier
    extends StateNotifier<IncomingOrderEntity?> {
  final ProviderOrdersRemoteDataSource _dataSource;
  final Ref _ref;

  Timer? _pollTimer;
  final Set<String> _dismissedOrderIds = {};
  bool _isPolling = false;

  ProviderIncomingOrdersNotifier(this._dataSource, this._ref) : super(null) {
    _startPolling();
    _ref.listen<AsyncValue<OrderNotification>>(
      orderNotificationEventsProvider,
      (_, next) {
        if (next.valueOrNull?.event == 'ORDER_REQUESTED') {
          unawaited(checkPendingOrders());
        }
      },
    );
    // Lắng nghe khi thợ chuyển trạng thái Online/Offline
    _ref.listen<AsyncValue<dynamic>>(providerDashboardProvider, (prev, next) {
      final wasOnline = prev?.value?.isOnline == true;
      final isNowOnline = next.value?.isOnline == true;
      if (!wasOnline && isNowOnline) {
        checkPendingOrders();
      } else if (wasOnline && !isNowOnline) {
        if (state != null) {
          state = null;
        }
      }
    });
  }

  void _startPolling() {
    _pollTimer?.cancel();
    // Thăm dò định kỳ mỗi 45 giây khi thợ đang mở app (SSE xử lý real-time)
    _pollTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      checkPendingOrders();
    });
    // Gọi ngay lần đầu
    checkPendingOrders();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  /// Kiểm tra các đơn hàng mới đang chờ thợ phản hồi
  Future<void> checkPendingOrders() async {
    // Chỉ kiểm tra đơn khi thợ đang BẬT nhận việc (isOnline == true)
    final dashboard = _ref.read(providerDashboardProvider).value;
    if (dashboard != null && !dashboard.isOnline) {
      if (state != null) {
        state = null;
      }
      return;
    }

    if (_isPolling) return;
    _isPolling = true;

    try {
      final list = await _dataSource.getPendingOrders();
      if (!mounted) return;
      if (list.isEmpty) {
        if (state != null) {
          state = null;
        }
        return;
      }

      // Tìm đơn pending đầu tiên chưa bị từ chối/bỏ qua
      for (final raw in list) {
        final orderId = raw['id']?.toString();
        if (orderId == null || _dismissedOrderIds.contains(orderId)) {
          continue;
        }

        final parsedOrder = IncomingOrderEntity.fromJson(raw);

        // Nếu khác đơn hiện tại thì cập nhật để nổ popup
        if (state?.id != parsedOrder.id) {
          state = parsedOrder;
        }
        return;
      }

      // Nếu tất cả đơn đã xử lý hoặc bỏ qua
      if (state != null && _dismissedOrderIds.contains(state!.id)) {
        state = null;
      }
    } catch (e) {
      debugPrint('⚠️ [ProviderIncomingOrders] Check error: $e');
    } finally {
      _isPolling = false;
    }
  }

  /// Chấp nhận đơn hàng thật qua API
  Future<bool> acceptOrder(String orderId) async {
    try {
      await _dataSource.acceptOrder(orderId);
      _dismissedOrderIds.add(orderId);
      if (!mounted) return true;
      state = null;
      // Làm mới danh sách đơn
      unawaited(checkPendingOrders());
      return true;
    } catch (e) {
      debugPrint('❌ [ProviderIncomingOrders] Accept error: $e');
      rethrow;
    }
  }

  /// Từ chối đơn hàng thật qua API
  Future<bool> rejectOrder(String orderId, {String? reason}) async {
    try {
      await _dataSource.rejectOrder(
        orderId,
        reason: reason ?? 'Không thể phục vụ trong khung giờ này.',
      );
      _dismissedOrderIds.add(orderId);
      if (!mounted) return true;
      state = null;
      unawaited(checkPendingOrders());
      return true;
    } catch (e) {
      debugPrint('❌ [ProviderIncomingOrders] Reject error: $e');
      _dismissedOrderIds.add(orderId);
      if (mounted) state = null;
      return false;
    }
  }

  /// Bỏ qua popup khi hết giờ hoặc đóng
  void dismissOrder(String orderId) {
    _dismissedOrderIds.add(orderId);
    if (state?.id == orderId) {
      state = null;
    }
  }
}

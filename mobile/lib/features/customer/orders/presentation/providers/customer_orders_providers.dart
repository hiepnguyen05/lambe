import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';

import '../../data/datasources/customer_orders_remote_datasource.dart';
import '../../data/repositories/customer_orders_repository_impl.dart';
import '../../domain/entities/customer_order_entity.dart';
import '../../domain/repositories/customer_orders_repository.dart';

import 'package:mobile/features/shared/auth/di/auth_providers.dart';

final customerOrdersRemoteDataSourceProvider =
    Provider<CustomerOrdersRemoteDataSource>((ref) {
      return DioCustomerOrdersRemoteDataSource(ref.watch(dioProvider));
    });

final customerOrdersRepositoryProvider = Provider<CustomerOrdersRepository>((
  ref,
) {
  return CustomerOrdersRepositoryImpl(
    ref.watch(customerOrdersRemoteDataSourceProvider),
  );
});

/// Danh sách tất cả đơn hàng của khách
final customerOrdersListProvider =
    FutureProvider.autoDispose<List<CustomerOrderEntity>>((ref) async {
      final userId = ref.watch(
        authNotifierProvider.select((auth) => auth.valueOrNull?.id),
      );
      if (userId == null) return [];
      final cache = ref.keepAlive();
      Timer? eviction;
      ref.onCancel(() {
        eviction = Timer(const Duration(seconds: 30), cache.close);
      });
      ref.onResume(() => eviction?.cancel());
      ref.onDispose(() => eviction?.cancel());
      final repo = ref.watch(customerOrdersRepositoryProvider);
      return repo.getMyOrders();
    });

class CustomerOrderDetailState {
  final CustomerOrderEntity? order;
  final bool isLoading;
  final String? errorMessage;
  final bool isCancelling;

  const CustomerOrderDetailState({
    this.order,
    this.isLoading = true,
    this.errorMessage,
    this.isCancelling = false,
  });

  CustomerOrderDetailState copyWith({
    CustomerOrderEntity? order,
    bool? isLoading,
    String? errorMessage,
    bool? isCancelling,
  }) {
    return CustomerOrderDetailState(
      order: order ?? this.order,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      isCancelling: isCancelling ?? this.isCancelling,
    );
  }
}

class CustomerOrderDetailNotifier
    extends StateNotifier<CustomerOrderDetailState> {
  final CustomerOrdersRepository _repository;
  final String orderId;
  final bool Function()? isSafetyBlocked;
  Timer? _pollingTimer;
  bool _fetching = false;
  bool _refreshQueued = false;
  bool _isPaused = false;

  CustomerOrderDetailNotifier(
    this._repository,
    this.orderId, {
    this.isSafetyBlocked,
  }) : super(const CustomerOrderDetailState()) {
    fetchOrder();
  }

  void pausePolling() {
    _isPaused = true;
    _stopPolling();
  }

  void resumePolling() {
    if (!_isPaused) return;
    _isPaused = false;
    if (!_fetching) _refreshQueued = false;
    final order = state.order;
    if (order != null && order.shouldPoll) {
      _startPollingIfNeeded(order.isPending);
      fetchOrder(silent: true);
    }
  }

  Future<void> fetchOrder({
    bool silent = false,
    bool queueIfBusy = false,
  }) async {
    if (_fetching) {
      if (queueIfBusy) _refreshQueued = true;
      return;
    }
    _fetching = true;
    if (!silent) {
      state = state.copyWith(isLoading: true, errorMessage: null);
    }
    try {
      final order = await _repository.getMyOrderById(orderId);
      if (!mounted) return;
      if (_isOlder(order)) {
        state = state.copyWith(isLoading: false);
        return;
      }
      state = state.copyWith(
        order: order,
        isLoading: false,
        errorMessage: null,
      );

      if (!_isPaused && order.shouldPoll) {
        _startPollingIfNeeded(order.isPending);
      } else {
        _stopPolling();
      }
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
    } finally {
      _fetching = false;
      if (_refreshQueued && mounted && !_isPaused) {
        _refreshQueued = false;
        unawaited(fetchOrder(silent: true));
      }
    }
  }

  void _startPollingIfNeeded(bool pending) {
    if (_isPaused) return;
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(Duration(seconds: pending ? 4 : 12), (_) {
      if (!mounted || _isPaused) {
        _stopPolling();
        return;
      }
      fetchOrder(silent: true);
    });
  }

  void _stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  DateTime _revision(CustomerOrderEntity order) {
    final orderTime = order.rescheduleSnapshot.revision;
    final extrasTime = order.addOnSnapshot?.revision;
    return extrasTime != null && extrasTime.isAfter(orderTime)
        ? extrasTime
        : orderTime;
  }

  bool _isOlder(CustomerOrderEntity next) =>
      state.order != null && _revision(next).isBefore(_revision(state.order!));

  void applyServerOrder(CustomerOrderEntity order) {
    if (!mounted || order.id != orderId || _isOlder(order)) return;
    state = state.copyWith(order: order, isLoading: false);
    if (!_isPaused && order.shouldPoll) {
      _startPollingIfNeeded(order.isPending);
    } else {
      _stopPolling();
    }
  }

  Future<bool> cancelOrder(String reason) async {
    if (_blocksMutation) return false;
    state = state.copyWith(isCancelling: true);
    try {
      final updated = await _repository.cancelOrder(orderId, reason: reason);
      if (!mounted) return true;
      state = state.copyWith(order: updated, isCancelling: false);
      _stopPolling();
      return true;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isCancelling: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }

  Future<bool> decideCancellation({required bool approve, String? note}) async {
    if (_blocksMutation) return false;
    try {
      final updated = await _repository.decideCancellation(
        orderId,
        approve: approve,
        note: note,
      );
      if (!mounted) return true;
      state = state.copyWith(order: updated, isLoading: false);
      if (!_isPaused && updated.shouldPoll) {
        _startPollingIfNeeded(updated.isPending);
      } else {
        _stopPolling();
      }
      return true;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }

  Future<bool> submitReview({required int rating, String? comment}) async {
    if (_blocksMutation) return false;
    try {
      final fresh = await _repository.getMyOrderById(orderId);
      if (!mounted) return false;
      applyServerOrder(fresh);
      if (fresh.id != orderId ||
          !fresh.canReview ||
          _blocksMutation ||
          state.order?.canReview != true) {
        state = state.copyWith(
          errorMessage:
              'Chỉ có thể đánh giá đơn đã hoàn thành và chưa có đánh giá.',
        );
        return false;
      }
      await _repository.submitReview(orderId, rating: rating, comment: comment);
      await fetchOrder(silent: true);
      return true;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }

  bool get _blocksMutation {
    if (state.order?.isPaymentDispute == true) {
      state = state.copyWith(
        errorMessage: 'Đơn đang chờ đối soát thanh toán. Vui lòng chờ hỗ trợ.',
      );
      return true;
    }
    final blocked =
        state.order?.isSafetyHold == true || isSafetyBlocked?.call() == true;
    if (blocked) {
      state = state.copyWith(
        errorMessage: 'Đơn đang tạm dừng vì an toàn. Vui lòng chờ hỗ trợ.',
      );
    }
    return blocked;
  }

  @override
  void dispose() {
    _stopPolling();
    super.dispose();
  }
}

final customerOrderDetailNotifierProvider = StateNotifierProvider.autoDispose
    .family<CustomerOrderDetailNotifier, CustomerOrderDetailState, String>((
      ref,
      orderId,
    ) {
      final repo = ref.watch(customerOrdersRepositoryProvider);
      return CustomerOrderDetailNotifier(
        repo,
        orderId,
        isSafetyBlocked: () => ref
            .read(
              orderSafetyProvider(SafetyScope(orderId, SafetyRole.customer)),
            )
            .blocksOrder,
      );
    });

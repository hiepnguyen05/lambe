import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/features/provider/income/di/provider_income_providers.dart';
import 'package:mobile/features/provider/location/di/provider_location_providers.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';
import 'package:mobile/features/shared/order_add_ons/application/order_add_ons_controller.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';

import '../data/datasources/provider_orders_remote_datasource.dart';
import '../di/provider_workspace_providers.dart';
import 'provider_order_execution_state.dart';
import 'provider_upcoming_appointments_provider.dart';

import 'package:mobile/features/shared/payment_dispute/domain/payment_dispute_order.dart';
import 'package:mobile/features/shared/payment_dispute/application/payment_dispute_controller.dart';

class ProviderOrderExecutionNotifier
    extends StateNotifier<ProviderOrderExecutionState> {
  final String orderId;
  final ProviderOrdersRemoteDataSource remoteDataSource;
  final Ref ref;
  Timer? _pollingTimer;
  bool _fetching = false;
  bool _refreshQueued = false;
  bool _isPaused = false;
  final Set<String> _loadingEvidenceIds = {};

  ProviderOrderExecutionNotifier({
    required this.orderId,
    required this.remoteDataSource,
    required this.ref,
  }) : super(const ProviderOrderExecutionState()) {
    ref.listen(orderSafetyProvider(SafetyScope(orderId, SafetyRole.provider)), (
      previous,
      next,
    ) {
      if (next.blocksOrder) {
        unawaited(
          ref
              .read(providerLocationCoordinatorProvider)
              .stop(onlyOrderId: orderId),
        );
      }
      if (previous?.blocksOrder == true && !next.blocksOrder) {
        unawaited(fetchDetail(silent: true, queueIfBusy: true));
      }
    });
    ref.listen(orderNotificationEventsProvider, (_, next) {
      final notice = next.valueOrNull;
      if (notice?.orderId == orderId) {
        if (notice!.event == 'ORDER_SAFETY_HOLD') {
          unawaited(
            ref
                .read(providerLocationCoordinatorProvider)
                .stop(onlyOrderId: orderId),
          );
          unawaited(
            ref
                .read(
                  orderSafetyProvider(SafetyScope(orderId, SafetyRole.provider))
                      .notifier,
                )
                .refresh(),
          );
        }
        unawaited(fetchDetail(silent: true, queueIfBusy: true));
      }
    });
    fetchDetail();
    _startPolling();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  void pausePolling() {
    _isPaused = true;
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }

  void resumePolling() {
    if (!_isPaused) return;
    _isPaused = false;
    if (!_fetching) _refreshQueued = false;
    if (state.isTerminal) return;
    _startPolling();
    fetchDetail(silent: true, queueIfBusy: true);
  }

  void _startPolling() {
    if (_isPaused || state.isTerminal) return;
    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 12), (_) {
      if (!state.isTerminal && mounted && !_isPaused) {
        fetchDetail(silent: true);
      } else {
        _pollingTimer?.cancel();
        _pollingTimer = null;
      }
    });
  }

  Future<void> fetchDetail({
    bool silent = false,
    bool queueIfBusy = false,
  }) async {
    if (_fetching) {
      if (queueIfBusy) _refreshQueued = true;
      return;
    }
    _fetching = true;
    if (!silent) {
      state = state.copyWith(isLoading: true, errorMessage: () => null);
    }

    try {
      final data = await remoteDataSource.getProviderOrderDetail(orderId);
      if (mounted) {
        _applyOrder(data);
        if (!_isPaused) unawaited(_loadEvidenceUrls(data));
      }
    } catch (e) {
      if (mounted) {
        state = state.copyWith(
          errorMessage: () => e.toString().replaceFirst('Exception: ', ''),
          isLoading: false,
        );
      }
    } finally {
      _fetching = false;
      if (_refreshQueued && mounted && !_isPaused) {
        _refreshQueued = false;
        unawaited(fetchDetail(silent: true));
      }
    }
  }

  void _applyOrder(Map<String, dynamic> data) {
    final hydrated = _withEvidenceUrls(data);
    final previous = state.order;
    final previousUpdatedAt = DateTime.tryParse(
      previous?['updatedAt']?.toString() ?? '',
    );
    final nextUpdatedAt = DateTime.tryParse(
      hydrated['updatedAt']?.toString() ?? '',
    );
    if (previousUpdatedAt != null &&
        nextUpdatedAt != null &&
        nextUpdatedAt.isBefore(previousUpdatedAt)) {
      return;
    }

    if (previous != null &&
        (previous['status'] != hydrated['status'] ||
            previous['expectedStartAt'] != hydrated['expectedStartAt'] ||
            previous['scheduledAt'] != hydrated['scheduledAt'])) {
      ref.invalidate(providerUpcomingAppointmentsProvider);
      if (previous['status'] != hydrated['status']) {
        ref.invalidate(providerOrdersListProvider);
        ref.invalidate(providerCompletedOrdersProvider);
        if (ref.exists(providerWalletNotifierProvider)) {
          unawaited(
            ref.read(providerWalletNotifierProvider.notifier).loadWalletData(),
          );
        }
      }
    }
    int nextSubStep = state.inProgressSubStep;
    if (previous?['status'] != hydrated['status']) {
      if (previous == null && hydrated['status'] == 'IN_PROGRESS') {
        final evidence = (hydrated['evidence'] as List<dynamic>?) ?? const [];
        if (evidence.any(
          (item) => item is Map && item['type'] == 'AFTER_WORK',
        )) {
          nextSubStep = 2;
        }
      }
      if (hydrated['status'] != 'IN_PROGRESS' && nextSubStep != 0) {
        nextSubStep = 0;
      }
    }
    // A delayed order response must not restart GPS after a local SOS.
    if (hydrated['status'] == 'EN_ROUTE' && !_safetyBlocked) {
      unawaited(_startEnRouteTracking());
    } else {
      unawaited(
        ref
            .read(providerLocationCoordinatorProvider)
            .stop(onlyOrderId: orderId),
      );
    }

    if (state.isLoading ||
        state.errorMessage != null ||
        previous == null ||
        jsonEncode(previous) != jsonEncode(hydrated) ||
        nextSubStep != state.inProgressSubStep) {
      if (jsonEncode(previous?['addOns']) != jsonEncode(hydrated['addOns'])) {
        final addOnProvider = orderAddOnsProvider(
          AddOnScope(orderId, AddOnRole.provider),
        );
        if (ref.exists(addOnProvider)) {
          ref.invalidate(addOnProvider);
        }
      }
      state = state.copyWith(
        order: () => hydrated,
        isLoading: false,
        errorMessage: () => null,
        inProgressSubStep: nextSubStep,
        cashReceivedChecked:
            hydrated['status'] != 'IN_PROGRESS' ||
                previous?['totalAmount'] != hydrated['totalAmount']
            ? false
            : state.cashReceivedChecked,
      );
    }
    if (state.isTerminal) {
      _pollingTimer?.cancel();
      _pollingTimer = null;
    }
  }

  Future<void> _startEnRouteTracking() async {
    final coordinator = ref.read(providerLocationCoordinatorProvider);
    try {
      await coordinator.start(orderId);
      await coordinator.capture(requestPermission: true);
    } catch (error) {
      debugPrint(
        '[ProviderOrderExecution] Failed to start location coordinator: $error',
      );
    }
  }

  Map<String, dynamic> _withEvidenceUrls(Map<String, dynamic> data) {
    final hydrated = Map<String, dynamic>.from(data);
    final evidence = (data['evidence'] as List<dynamic>?) ?? const [];
    hydrated['evidence'] = evidence.map((item) {
      if (item is! Map) return item;
      final copy = Map<String, dynamic>.from(item);
      final id = copy['id']?.toString();
      if (id != null && state.evidenceUrls[id] != null) {
        copy['filePath'] = state.evidenceUrls[id];
      }
      return copy;
    }).toList();
    return hydrated;
  }

  Future<void> _loadEvidenceUrls(Map<String, dynamic> order) async {
    final evidence = (order['evidence'] as List<dynamic>?) ?? const [];
    final pending = evidence.whereType<Map>().where((item) {
      final id = item['id']?.toString();
      return id != null &&
          !state.evidenceUrls.containsKey(id) &&
          !_loadingEvidenceIds.contains(id);
    }).toList();
    if (pending.isEmpty) return;

    final Map<String, String> updatedUrls = Map.from(state.evidenceUrls);
    await Future.wait(
      pending.map((item) async {
        final id = item['id']!.toString();
        _loadingEvidenceIds.add(id);
        try {
          final url = await remoteDataSource.getEvidenceSignedUrl(orderId, id);
          if (url != null && url.isNotEmpty) {
            updatedUrls[id] = url;
          }
        } catch (error) {
          debugPrint(
            '[ProviderOrderExecution] Failed to load signed evidence URL for $id: $error',
          );
        } finally {
          _loadingEvidenceIds.remove(id);
        }
      }),
    );

    if (mounted && state.order != null) {
      state = state.copyWith(
        evidenceUrls: updatedUrls,
        order: () => _withEvidenceUrls(state.order!),
      );
    }
  }

  void setCashReceivedChecked(bool value) {
    if (_paymentBlocked) return;
    state = state.copyWith(cashReceivedChecked: value);
  }

  void setInProgressSubStep(int step) {
    state = state.copyWith(inProgressSubStep: step);
  }

  void clearError() {
    if (state.errorMessage != null) {
      state = state.copyWith(errorMessage: () => null);
    }
  }

  Future<bool> handleAction(Future<dynamic> Function() action) async {
    if (state.isActionLoading ||
        _paymentBlocked ||
        state.status == 'SAFETY_HOLD' ||
        _safetyBlocked) {
      return false;
    }
    state = state.copyWith(isActionLoading: true, errorMessage: () => null);
    try {
      final result = await action();
      if (mounted) {
        if (result is Map<String, dynamic> && result['status'] != null) {
          _applyOrder(result);
        } else {
          await fetchDetail(silent: true, queueIfBusy: true);
        }
      }
      return true;
    } catch (e) {
      if (mounted) {
        state = state.copyWith(
          errorMessage: () => e.toString().replaceFirst('Exception: ', ''),
        );
      }
      return false;
    } finally {
      if (mounted) {
        state = state.copyWith(isActionLoading: false);
      }
    }
  }

  bool get _safetyBlocked => ref
      .read(orderSafetyProvider(SafetyScope(orderId, SafetyRole.provider)))
      .blocksOrder;

  Future<bool> acceptOrder() =>
      handleAction(() => remoteDataSource.acceptOrder(orderId));

  Future<bool> markEnRoute() =>
      handleAction(() => remoteDataSource.markEnRoute(orderId));

  Future<bool> markArrived({
    required double latitude,
    required double longitude,
    required double accuracyMeters,
    required DateTime capturedAt,
  }) => handleAction(
    () => remoteDataSource.markArrived(
      orderId,
      latitude: latitude,
      longitude: longitude,
      accuracyMeters: accuracyMeters,
      capturedAt: capturedAt,
    ),
  );

  Future<bool> startOrder() =>
      handleAction(() => remoteDataSource.startOrder(orderId));

  Future<bool> pauseWork() =>
      handleAction(() => remoteDataSource.pauseWork(orderId));

  Future<bool> resumeWork() =>
      handleAction(() => remoteDataSource.resumeWork(orderId));

  bool get addOnsBlockCompletion {
    final provider = orderAddOnsProvider(
      AddOnScope(orderId, AddOnRole.provider),
    );
    final extras = ref.exists(provider) ? ref.read(provider) : null;
    if (extras?.busy == true) {
      return true;
    }
    return (state.order?['addOns'] as List? ?? []).whereType<Map>().any(
      (item) =>
          item['status'] == 'PENDING' &&
          (DateTime.tryParse(item['expiresAt']?.toString() ?? '')
                  ?.isAfter(DateTime.now()) ??
              true),
    );
  }

  Future<bool> completeOrder({required bool cashReceived}) => handleAction(() {
    if (addOnsBlockCompletion) {
      throw Exception(
        'Cần xử lý dịch vụ phát sinh hoặc tải lại trạng thái trước khi hoàn thành đơn.',
      );
    }
    return remoteDataSource.completeOrder(orderId, cashReceived: cashReceived);
  });

  PaymentDisputeScope get _paymentScope =>
      PaymentDisputeScope(orderId, PaymentDisputeRole.provider);
  bool get _paymentBlocked {
    final source = paymentDisputeProvider(_paymentScope);
    return isPaymentDisputed(state.status) ||
        (ref.exists(source) && ref.read(source).blocksActions);
  }

  void applyServerOrder(Map<String, dynamic> data) {
    if (mounted && data['id'] == orderId) {
      _applyOrder(data);
    }
  }

  Future<bool> openPaymentDispute(String reason) async {
    if (state.isActionLoading ||
        _paymentBlocked ||
        _safetyBlocked ||
        state.status != 'IN_PROGRESS') {
      return false;
    }
    state = state.copyWith(
      isActionLoading: true,
      cashReceivedChecked: false,
      errorMessage: () => null,
    );
    try {
      final json = await ref
          .read(paymentDisputeProvider(_paymentScope).notifier)
          .open(reason);
      if (!mounted) return false;
      if (json == null) {
        state = state.copyWith(
          errorMessage: () =>
              ref.read(paymentDisputeProvider(_paymentScope)).error,
        );
        return false;
      }
      applyServerOrder(json);
      return true;
    } finally {
      if (mounted) state = state.copyWith(isActionLoading: false);
    }
  }

  Future<bool> recordContactAttempt() =>
      handleAction(() => remoteDataSource.recordContactAttempt(orderId));

  Future<bool> requestCancellation({required String reason, String? detail}) =>
      handleAction(
        () => remoteDataSource.requestCancellation(
          orderId,
          reason: reason,
          detail: detail,
        ),
      );

  Future<bool> cancelOrder({required String reason}) =>
      handleAction(() => remoteDataSource.cancelOrder(orderId, reason: reason));

  Future<bool> rejectOrder({required String reason}) =>
      handleAction(() => remoteDataSource.rejectOrder(orderId, reason: reason));

  Future<bool> uploadEvidence(
    String type,
    String filePath, {
    double? latitude,
    double? longitude,
  }) async {
    if (state.isActionLoading ||
        _paymentBlocked ||
        state.status == 'SAFETY_HOLD' ||
        _safetyBlocked) {
      return false;
    }
    state = state.copyWith(isActionLoading: true, errorMessage: () => null);
    try {
      final created = await remoteDataSource.uploadEvidence(
        orderId,
        type,
        filePath,
        latitude: latitude,
        longitude: longitude,
      );
      if (!mounted) return true;
      final currentOrder = state.order;
      final evidenceId = created['id']?.toString();
      final url = created['url']?.toString();
      if (currentOrder != null && evidenceId != null) {
        final updatedUrls = Map<String, String>.from(state.evidenceUrls);
        if (url != null && url.isNotEmpty) {
          updatedUrls[evidenceId] = url;
        }
        final updatedOrder = Map<String, dynamic>.from(currentOrder);
        final list = List<dynamic>.from(
          (currentOrder['evidence'] as List<dynamic>?) ?? const [],
        );
        list.add({
          'id': evidenceId,
          'type': created['type'] ?? type,
          'capturedAt':
              created['capturedAt'] ?? DateTime.now().toUtc().toIso8601String(),
          if (url != null && url.isNotEmpty) 'filePath': url,
        });
        updatedOrder['evidence'] = list;
        state = state.copyWith(
          evidenceUrls: updatedUrls,
          order: () => updatedOrder,
        );
      } else {
        await fetchDetail(silent: true, queueIfBusy: true);
      }
      return true;
    } catch (e) {
      if (mounted) {
        state = state.copyWith(
          errorMessage: () => e.toString().replaceFirst('Exception: ', ''),
        );
      }
      return false;
    } finally {
      if (mounted) {
        state = state.copyWith(isActionLoading: false);
      }
    }
  }
}

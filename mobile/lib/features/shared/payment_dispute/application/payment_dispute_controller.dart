import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/network_exceptions.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';

import '../data/payment_dispute_repository.dart';
import '../domain/payment_dispute_order.dart';

class PaymentDisputeState {
  final PaymentDisputeOrder? order;
  final bool busy, opening, uncertain;
  final String? error;
  const PaymentDisputeState({
    this.order,
    this.busy = false,
    this.opening = false,
    this.uncertain = false,
    this.error,
  });
  bool get blocksActions => opening || uncertain;
}

class PaymentDisputeController extends StateNotifier<PaymentDisputeState> {
  final PaymentDisputeRepository repository;
  final PaymentDisputeScope scope;
  final bool Function() safetyBlocked;
  final cancel = CancelToken();
  PaymentDisputeController(
    this.repository,
    this.scope, {
    required this.safetyBlocked,
  }) : super(const PaymentDisputeState());

  Future<Map<String, dynamic>?> refresh() async {
    if (state.busy) return null;
    final previous = state;
    state = PaymentDisputeState(
      order: previous.order,
      busy: true,
      uncertain: previous.uncertain,
    );
    try {
      final json = await repository.read(scope, cancel);
      if (!mounted) return null;
      state = PaymentDisputeState(order: PaymentDisputeOrder.fromJson(json));
      return json;
    } catch (error) {
      if (mounted) {
        state = PaymentDisputeState(
          order: previous.order,
          uncertain: previous.uncertain,
          error: message(error),
        );
      }
      return null;
    }
  }

  Future<Map<String, dynamic>?> open(String reason) async {
    if (state.busy || state.uncertain || safetyBlocked()) return null;
    var current = state.order;
    var posted = false;
    state = PaymentDisputeState(order: current, busy: true, opening: true);
    try {
      if (scope.role != PaymentDisputeRole.provider) {
        throw const ValidationFailure(
          'Chỉ thợ thực hiện đơn được báo chưa nhận đủ tiền.',
        );
      }
      final invalid = validatePaymentDisputeReason(reason);
      if (invalid != null) throw ValidationFailure(invalid);
      final json = await repository.read(scope, cancel);
      if (!mounted) return null;
      current = PaymentDisputeOrder.fromJson(json);
      if (current.active ||
          (current.status == 'COMPLETED' && current.hasHistory)) {
        state = PaymentDisputeState(order: current);
        return json;
      }
      if (safetyBlocked() ||
          current.status != 'IN_PROGRESS' ||
          current.pendingCancellation) {
        throw const ValidationFailure(
          'Đơn không còn ở bước cho phép báo chưa nhận tiền. Vui lòng tải lại trạng thái.',
        );
      }
      if (!current.afterWorkEvidence) {
        throw const ValidationFailure(
          'Cần tải ảnh kết quả sau khi làm trước khi gửi báo cáo.',
        );
      }
      if (current.hold?.status != 'ACTIVE') {
        throw const ValidationFailure(
          'Chưa có khoản tạm giữ hợp lệ của đơn. Vui lòng tải lại.',
        );
      }
      posted = true;
      final receipt = await repository.open(scope, reason.trim(), cancel);
      final updated = PaymentDisputeOrder.fromJson(receipt);
      if (!updated.active) {
        throw const FormatException(
          'Chưa xác nhận được trạng thái tranh chấp.',
        );
      }
      if (mounted) state = PaymentDisputeState(order: updated);
      return mounted ? receipt : null;
    } catch (error) {
      if (!mounted) return null;
      final unknown =
          posted &&
          (error is! DioException ||
              error.type != DioExceptionType.badResponse ||
              (error.response?.statusCode ?? 0) >= 500);
      if (posted) {
        try {
          final json = await repository.read(scope, cancel);
          if (!mounted) return null;
          current = PaymentDisputeOrder.fromJson(json);
          if (current.active ||
              (current.status == 'COMPLETED' && current.hasHistory)) {
            state = PaymentDisputeState(order: current);
            return json;
          }
          state = PaymentDisputeState(
            order: current,
            uncertain: unknown,
            error: unknown
                ? 'Chưa xác nhận được kết quả gửi. Đã tải trạng thái hiện tại; hãy kiểm tra trước khi thử lại.'
                : message(error),
          );
          return null;
        } catch (_) {
          /* Reconcile with GET, never automatically replay a POST. */
        }
      }
      if (mounted) {
        state = PaymentDisputeState(
          order: current,
          uncertain: unknown,
          error: unknown
              ? 'Chưa xác nhận được kết quả. Vui lòng kiểm tra lại trạng thái trước khi thao tác đơn.'
              : message(error),
        );
      }
      return null;
    }
  }

  static String message(Object error) => error is AppFailure
      ? error.message
      : error is DioException
      ? ExceptionHandler.handleDioError(error).message
      : 'Chưa đọc được thông tin thanh toán. Vui lòng tải lại.';
  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}

final paymentDisputeProvider = StateNotifierProvider.autoDispose
    .family<PaymentDisputeController, PaymentDisputeState, PaymentDisputeScope>(
      (ref, scope) {
        ref.watch(
          authNotifierProvider.select((state) => state.valueOrNull?.id),
        );
        final controller = PaymentDisputeController(
          ref.watch(paymentDisputeRepositoryProvider),
          scope,
          safetyBlocked: () => ref
              .read(
                orderSafetyProvider(
                  SafetyScope(
                    scope.orderId,
                    scope.role == PaymentDisputeRole.provider
                        ? SafetyRole.provider
                        : SafetyRole.customer,
                  ),
                ),
              )
              .blocksOrder,
        );
        KeepAliveLink? pending;
        final remove = controller.addListener((state) {
          if (state.blocksActions) {
            pending ??= ref.keepAlive();
          } else {
            pending?.close();
            pending = null;
          }
        });
        ref.onDispose(remove);
        return controller;
      },
    );

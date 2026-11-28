import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/network_exceptions.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';

import '../data/order_reschedule_repository.dart';
import '../domain/order_reschedule.dart';

class RescheduleState {
  final RescheduleOrder? order;
  final bool busy;
  final bool needsRefresh;
  final String? error;
  const RescheduleState({
    this.order,
    this.busy = false,
    this.needsRefresh = false,
    this.error,
  });
}

class OrderRescheduleController extends StateNotifier<RescheduleState> {
  final OrderRescheduleRepository repository;
  final RescheduleScope scope;
  final bool Function() safetyBlocked;
  final DateTime Function() clock;
  final cancel = CancelToken();
  OrderRescheduleController(
    this.repository,
    this.scope, {
    required this.safetyBlocked,
    DateTime Function()? clock,
  }) : clock = clock ?? DateTime.now,
       super(const RescheduleState());

  Future<void> refresh() async {
    if (state.busy) return;
    final previous = state;
    state = RescheduleState(
      order: previous.order,
      busy: true,
      needsRefresh: previous.needsRefresh,
    );
    try {
      final order = await repository.read(scope, cancel);
      if (mounted) state = RescheduleState(order: order);
    } catch (error) {
      if (mounted) {
        state = RescheduleState(
          order: previous.order,
          needsRefresh: previous.needsRefresh,
          error: message(error),
        );
      }
    }
  }

  Future<bool> request(DateTime time) => _submit(time: time);
  Future<bool> decide(RescheduleProposal proposal, bool approve) =>
      _submit(proposal: proposal, approve: approve);

  Future<bool> _submit({
    DateTime? time,
    RescheduleProposal? proposal,
    bool? approve,
  }) async {
    if (state.busy || state.needsRefresh || safetyBlocked()) return false;
    var current = state.order;
    var posted = false;
    String? previousProposalId;
    state = RescheduleState(order: current, busy: true);
    try {
      current = await repository.read(scope, cancel);
      if (!mounted) return false;
      if (!current.eligible || safetyBlocked()) {
        throw const ValidationFailure(
          'Chỉ đổi lịch đơn đặt trước đã được nhận và chưa khởi hành.',
        );
      }
      if (time != null) {
        final error = validateRescheduleTime(time, clock(), current.startAt);
        if (error != null) {
          throw ValidationFailure(error);
        }
        if (current.proposal?.isPending(clock()) == true) {
          throw const ValidationFailure(
            'Đơn đang chờ phản hồi một yêu cầu đổi lịch.',
          );
        }
      } else {
        if (current.proposal?.requestedBy == scope.role ||
            current.proposal?.id != proposal!.id ||
            current.proposal?.isPending(clock()) != true) {
          throw const ValidationFailure(
            'Yêu cầu đã thay đổi hoặc hết hạn. Vui lòng kiểm tra lịch mới nhất.',
          );
        }
      }
      posted = true;
      previousProposalId = current.proposal?.id;
      final receipt = time != null
          ? await repository.request(scope, time, cancel)
          : await repository.decide(scope, proposal!.id, approve!, cancel);
      if (!mounted) return false;
      current = RescheduleOrder(
        id: current.id,
        status: current.status,
        bookingType: current.bookingType,
        startAt: current.startAt,
        updatedAt: current.updatedAt,
        overdueAt: current.overdueAt,
        proposal: receipt,
      );
      // Acknowledgement is authoritative, but dates still come from a fresh order read.
      try {
        final updated = await repository.read(scope, cancel);
        if (mounted) state = RescheduleState(order: updated);
      } catch (error) {
        if (mounted) {
          state = RescheduleState(
            order: current,
            needsRefresh: true,
            error: 'Đã ghi nhận phản hồi nhưng chưa đồng bộ được lịch. Vui lòng tải lại.',
          );
        }
      }
      return true;
    } catch (error) {
      if (!mounted) return false;
      final ambiguous =
          posted &&
          (error is! DioException ||
              error.type != DioExceptionType.badResponse ||
              (error.response?.statusCode ?? 0) >= 500);
      var reconciled = !ambiguous;
      if (posted) {
        try {
          current = await repository.read(scope, cancel);
          reconciled = true;
          final latest = current.proposal;
          final confirmed =
              ambiguous &&
              latest != null &&
              (time != null
                  ? latest.requestedBy == scope.role &&
                        latest.startAt.isAtSameMomentAs(time) &&
                        latest.id != previousProposalId
                  : latest.id == proposal!.id &&
                        latest.status == (approve! ? 'ACCEPTED' : 'REJECTED'));
          if (confirmed) {
            if (mounted) state = RescheduleState(order: current);
            return true;
          }
        } catch (_) {
          /* Never retry a POST automatically after an uncertain outcome. */
        }
      }
      if (mounted) {
        state = RescheduleState(
          order: current,
          needsRefresh: !reconciled,
          error: ambiguous
              ? 'Chưa xác nhận được kết quả. Kiểm tra trạng thái trước khi thử lại.'
              : message(error),
        );
      }
      return false;
    }
  }

  static String message(Object error) => error is AppFailure
      ? error.message
      : error is DioException
      ? ExceptionHandler.handleDioError(error).message
      : 'Chưa đọc được lịch từ máy chủ. Vui lòng tải lại.';
  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}

final orderRescheduleProvider = StateNotifierProvider.autoDispose
    .family<OrderRescheduleController, RescheduleState, RescheduleScope>((
      ref,
      scope,
    ) {
      ref.watch(authNotifierProvider.select((state) => state.valueOrNull?.id));
      return OrderRescheduleController(
        ref.watch(orderRescheduleRepositoryProvider),
        scope,
        safetyBlocked: () => ref
            .read(
              orderSafetyProvider(
                SafetyScope(
                  scope.orderId,
                  scope.role == RescheduleRole.customer
                      ? SafetyRole.customer
                      : SafetyRole.provider,
                ),
              ),
            )
            .blocksOrder,
      );
    });

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/network/network_exceptions.dart';
import 'package:mobile/core/utils/uuid_utils.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';

import '../data/order_add_ons_repository.dart';
import '../domain/add_on_order.dart';
import '../domain/order_add_on.dart';

class AddOnsState {
  final AddOnOrder? order;
  final List<AddOnOption>? options;
  final bool busy, needsRefresh;
  final String? error;
  const AddOnsState({
    this.order,
    this.options,
    this.busy = false,
    this.needsRefresh = false,
    this.error,
  });
}

enum _Action { propose, approve, reject, withdraw }

class OrderAddOnsController extends StateNotifier<AddOnsState> {
  final OrderAddOnsRepository repository;
  final AddOnScope scope;
  final bool Function() safetyBlocked;
  final DateTime Function() clock;
  final cancel = CancelToken();
  String? _serviceId, _note, _key;
  Set<String> _previousIds = {};
  void _reconcileIntent(AddOnOrder order) {
    if (_key != null &&
        order.items.any(
          (row) =>
              !_previousIds.contains(row.id) &&
              row.providerServiceId == _serviceId &&
              row.note == _note,
        )) {
      _key = null;
    }
  }

  OrderAddOnsController(
    this.repository,
    this.scope, {
    required this.safetyBlocked,
    DateTime Function()? clock,
  }) : clock = clock ?? DateTime.now,
       super(const AddOnsState());

  Future<void> refresh({bool options = false}) async {
    if (state.busy) return;
    final previous = state;
    state = AddOnsState(
      order: previous.order,
      options: previous.options,
      busy: true,
      needsRefresh: previous.needsRefresh,
    );
    try {
      if (options && scope.role != AddOnRole.provider) {
        throw const ValidationFailure(
          'Chỉ thợ được xem dịch vụ có thể đề xuất.',
        );
      }
      final order = await repository.read(scope, cancel);
      if (!mounted) return;
      _reconcileIntent(order);
      if (options && (!order.canPropose(clock()) || safetyBlocked())) {
        throw const ValidationFailure(
          'Đơn chưa đủ điều kiện thêm dịch vụ hoặc đang chờ xử lý đề nghị khác.',
        );
      }
      final rows = options
          ? await repository.options(scope, cancel)
          : previous.options;
      if (mounted) state = AddOnsState(order: order, options: rows);
    } catch (error) {
      if (mounted) {
        state = AddOnsState(
          order: previous.order,
          options: previous.options,
          needsRefresh: previous.needsRefresh,
          error: message(error),
        );
      }
    }
  }

  Future<AddOnOutcome> propose(AddOnOption option, String note) =>
      _submit(_Action.propose, option: option, note: note);
  Future<AddOnOutcome> decide(OrderAddOn item, bool approve) =>
      _submit(approve ? _Action.approve : _Action.reject, item: item);
  Future<AddOnOutcome> withdraw(OrderAddOn item) =>
      _submit(_Action.withdraw, item: item);

  Future<AddOnOutcome> _submit(
    _Action action, {
    AddOnOption? option,
    OrderAddOn? item,
    String note = '',
  }) async {
    if (state.busy || state.needsRefresh || safetyBlocked()) {
      return const AddOnOutcome(false);
    }
    final options = state.options;
    var order = state.order;
    var posted = false;
    var acknowledged = false;
    state = AddOnsState(order: order, options: options, busy: true);
    try {
      final normalizedNote = note.trim();
      if (normalizedNote.runes.length > 500) {
        throw const ValidationFailure('Ghi chú tối đa 500 ký tự.');
      }
      final providerAction =
          action == _Action.propose || action == _Action.withdraw;
      if (providerAction != (scope.role == AddOnRole.provider)) {
        throw const ValidationFailure('Tài khoản không có quyền thao tác này.');
      }
      order = await repository.read(scope, cancel);
      if (!mounted) return const AddOnOutcome(false);
      _reconcileIntent(order);
      if (!order.eligible || safetyBlocked()) {
        throw const ValidationFailure(
          'Chỉ xử lý phát sinh khi đã đến hoặc đang làm, không có yêu cầu hủy/SOS.',
        );
      }
      if (action == _Action.propose) {
        if (!order.canPropose(clock())) {
          throw const ValidationFailure(
            'Đang có đề nghị chờ hoặc đã đủ 5 dịch vụ phát sinh.',
          );
        }
        final rows = await repository.options(scope, cancel);
        if (!mounted) return const AddOnOutcome(false);
        AddOnOption? current;
        for (final row in rows) {
          if (row.providerServiceId == option!.providerServiceId) current = row;
        }
        if (current == null || !current.available) {
          throw const ValidationFailure(
            'Dịch vụ không còn đáp ứng lịch hoặc điều kiện nhận thêm.',
          );
        }
        if (current.priceAmount != option!.priceAmount ||
            current.durationMinutes != option.durationMinutes) {
          throw const ValidationFailure(
            'Giá hoặc thời lượng đã thay đổi. Vui lòng tải lại dịch vụ.',
          );
        }
        if (safetyBlocked()) {
          throw const ValidationFailure('Đơn đang được tạm dừng vì an toàn.');
        }
        final cleaned = normalizedNote.isEmpty ? null : normalizedNote;
        if (_serviceId != current.providerServiceId ||
            _note != cleaned ||
            _key == null) {
          _serviceId = current.providerServiceId;
          _note = cleaned;
          _key = UuidUtils.generateV4();
          _previousIds = order.items.map((row) => row.id).toSet();
        }
        posted = true;
        await repository.propose(
          scope,
          current.providerServiceId,
          cleaned,
          _key!,
          cancel,
        );
        acknowledged = true;
        _key = null;
      } else {
        final current = order.item(item!.id);
        if (current == null || !current.pending(clock())) {
          throw const ValidationFailure(
            'Đề nghị đã thay đổi, hết hạn hoặc được xử lý.',
          );
        }
        if (action == _Action.approve &&
            (current.priceAmount != item.priceAmount ||
                current.durationMinutes != item.durationMinutes ||
                current.proposedTotalAmount != item.proposedTotalAmount ||
                current.proposedEndAt != item.proposedEndAt)) {
          throw const ValidationFailure(
            'Nội dung đề nghị đã thay đổi. Hãy xem lại trước khi chấp nhận.',
          );
        }
        posted = true;
        if (action == _Action.withdraw) {
          await repository.withdraw(scope, current.id, cancel);
          acknowledged = true;
        } else {
          final json = await repository.decide(
            scope,
            current.id,
            action == _Action.approve,
            cancel,
          );
          if (mounted) {
            state = AddOnsState(
              order: AddOnOrder.fromJson(json),
              options: options,
            );
          }
          return AddOnOutcome(true, orderJson: json);
        }
      }
      if (!mounted) return AddOnOutcome(acknowledged);
      order = await repository.read(scope, cancel);
      if (mounted) state = AddOnsState(order: order, options: options);
      return const AddOnOutcome(true);
    } catch (error) {
      if (!mounted) return const AddOnOutcome(false);
      var reconciled = !posted;
      if (posted) {
        try {
          order = await repository.read(scope, cancel);
          _reconcileIntent(order);
          reconciled = true;
        } catch (_) {
          /* No automatic POST retry. */
        }
      }
      final uncertain =
          posted &&
          (error is! DioException ||
              error.type != DioExceptionType.badResponse ||
              (error.response?.statusCode ?? 0) >= 500);
      if (mounted) {
        state = AddOnsState(
          order: order,
          options: options,
          needsRefresh: !reconciled,
          error: acknowledged
              ? 'Máy chủ đã ghi nhận nhưng chưa tải được đơn mới. Vui lòng tải lại.'
              : uncertain
              ? 'Chưa xác nhận được kết quả. Kiểm tra đơn trước khi thử lại.'
              : message(error),
        );
      }
      return AddOnOutcome(acknowledged);
    }
  }

  static String message(Object error) => error is AppFailure
      ? error.message
      : error is DioException
      ? ExceptionHandler.handleDioError(error).message
      : 'Chưa đọc được dịch vụ phát sinh. Vui lòng tải lại.';
  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}

final orderAddOnsProvider = StateNotifierProvider.autoDispose
    .family<OrderAddOnsController, AddOnsState, AddOnScope>((ref, scope) {
      ref.watch(authNotifierProvider.select((state) => state.valueOrNull?.id));
      return OrderAddOnsController(
        ref.watch(orderAddOnsRepositoryProvider),
        scope,
        safetyBlocked: () => ref
            .read(
              orderSafetyProvider(
                SafetyScope(
                  scope.orderId,
                  scope.role == AddOnRole.customer
                      ? SafetyRole.customer
                      : SafetyRole.provider,
                ),
              ),
            )
            .blocksOrder,
      );
    });

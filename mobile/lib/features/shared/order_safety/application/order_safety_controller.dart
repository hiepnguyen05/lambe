import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../data/order_safety_repository.dart';
import '../domain/order_safety.dart';

class SafetyState {
  final SafetyIncident? incident;
  final bool busy;
  final bool uncertain;
  final bool submitting;
  final String? error;
  const SafetyState({
    this.incident,
    this.busy = false,
    this.uncertain = false,
    this.submitting = false,
    this.error,
  });
  bool get blocksOrder => submitting || uncertain || incident?.isOpen == true;
}

class OrderSafetyController extends StateNotifier<SafetyState> {
  final OrderSafetyRepository repository;
  final SafetyScope scope;
  final cancel = CancelToken();
  OrderSafetyController(this.repository, this.scope)
    : super(const SafetyState());
  String? get errorMessage => state.error;

  Future<void> refresh() async {
    if (state.busy) return;
    final previous = state;
    state = SafetyState(
      incident: previous.incident,
      busy: true,
      uncertain: previous.uncertain,
    );
    try {
      final incident = await repository.mine(scope, cancel);
      if (mounted) state = SafetyState(incident: incident);
    } catch (error) {
      if (mounted) {
        state = SafetyState(
          incident: previous.incident,
          uncertain: previous.uncertain,
          error: OrderSafetyRepository.message(error),
        );
      }
    }
  }

  Future<void> raise() async {
    if (state.busy ||
        (state.incident?.ownReport == true && state.incident!.isOpen)) {
      return;
    }
    final previous = state;
    state = SafetyState(
      incident: previous.incident,
      busy: true,
      submitting: true,
      uncertain: previous.uncertain,
    );
    var submitted = false;
    try {
      if (previous.uncertain) {
        // Reconcile an ambiguous POST before sending another one.
        try {
          final found = await repository.mine(scope, cancel);
          if (!mounted) return;
          if (found.ownReport || !found.isOpen) {
            state = SafetyState(incident: found);
            return;
          }
        } on DioException catch (error) {
          if (error.response?.statusCode != 404) rethrow;
        }
      }
      submitted = true;
      final incident = await repository.raise(scope, cancel);
      if (mounted) {
        state = SafetyState(
          incident: SafetyIncident(
            id: incident.id,
            status: incident.status,
            ownReport: true,
            evidenceIds: incident.evidenceIds,
          ),
        );
      }
    } catch (error) {
      if (!mounted) return;
      final ambiguous =
          submitted &&
          (error is! DioException ||
              error.type != DioExceptionType.badResponse ||
              (error.response?.statusCode ?? 0) >= 500);
      if (ambiguous) {
        try {
          final found = await repository.mine(scope, cancel);
          if (mounted) {
            state = SafetyState(
              incident: found,
              uncertain: found.isOpen && !found.ownReport,
              error: found.ownReport
                  ? null
                  : OrderSafetyRepository.message(error),
            );
          }
          return;
        } catch (_) {
          /* Keep an explicit unknown state if reconciliation fails. */
        }
      }
      if (mounted) {
        state = SafetyState(
          incident: previous.incident,
          uncertain: ambiguous || previous.uncertain,
          error: OrderSafetyRepository.message(error),
        );
      }
    }
  }

  Future<void> upload(XFile file) async {
    final incident = state.incident;
    if (state.busy ||
        incident == null ||
        !incident.isOpen ||
        !incident.ownReport) {
      return;
    }
    if (incident.evidenceIds.length >= 5) return;
    state = SafetyState(incident: incident, busy: true);
    try {
      await repository.upload(scope, file, cancel);
      if (!mounted) return;
      final updated = await repository.mine(scope, cancel);
      if (mounted) state = SafetyState(incident: updated);
    } catch (error) {
      if (mounted) {
        state = SafetyState(
          incident: incident,
          error:
              '${OrderSafetyRepository.message(error)} Kiểm tra danh sách ảnh trước khi tải lại.',
        );
      }
    }
  }

  Future<String> evidenceUrl(String id) =>
      repository.evidenceUrl(scope, id, cancel);
  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}

final orderSafetyProvider = StateNotifierProvider.autoDispose
    .family<OrderSafetyController, SafetyState, SafetyScope>((ref, scope) {
      ref.watch(authNotifierProvider.select((state) => state.valueOrNull?.id));
      final controller = OrderSafetyController(
        ref.watch(orderSafetyRepositoryProvider),
        scope,
      );
      // Keep an unresolved SOS across route changes, without retaining signed URLs.
      KeepAliveLink? hold;
      final removeListener = controller.addListener((state) {
        if (state.blocksOrder) {
          hold ??= ref.keepAlive();
        } else {
          hold?.close();
          hold = null;
        }
      });
      ref.onDispose(removeListener);
      return controller;
    });

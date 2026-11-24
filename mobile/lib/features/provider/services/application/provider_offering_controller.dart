import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/error/app_failure.dart';

import '../data/provider_services_repository.dart';
import '../domain/provider_offering.dart';
import 'service_resource_state.dart';
import 'service_operation.dart';

class ProviderOfferingController
    extends StateNotifier<ServiceResourceState<ProviderOffering>> {
  final ProviderServicesRepository repository;
  final String id;
  final void Function() changed;
  final cancel = CancelToken();
  ProviderOfferingController(this.repository, this.id, {required this.changed})
    : super(const ServiceResourceState());
  Future<void> load() async {
    if (state.busy) return;
    final previous = state;
    state = ServiceResourceState(
      value: previous.value,
      busy: true,
      uncertain: previous.uncertain,
    );
    try {
      final value = await repository.offering(id, cancel);
      if (mounted) state = ServiceResourceState(value: value);
    } catch (error) {
      if (mounted) {
        state = ServiceResourceState(
          value: previous.value,
          uncertain: previous.uncertain,
          error: serviceError(error),
        );
      }
    }
  }

  Future<bool> setActive(bool active) async {
    if (state.blocked) return false;
    var value = state.value;
    var sent = false;
    state = ServiceResourceState(value: value, busy: true);
    try {
      value = await repository.offering(id, cancel);
      if (!mounted) return false;
      if (value.suspended || (active && value.blockerCode != null)) {
        throw ValidationFailure(
          offeringBlockerLabel(value.blockerCode ?? 'SUSPENDED'),
        );
      }
      if (value.active != active) {
        sent = true;
        value = await repository.availability(id, active, cancel);
      }
      if (!mounted) return false;
      state = ServiceResourceState(value: value);
      changed();
      return value.active == active;
    } catch (error) {
      if (!mounted) return false;
      var uncertain = sent && serviceOutcomeUnknown(error);
      if (sent) {
        try {
          value = await repository.offering(id, cancel);
          uncertain = false;
          if (mounted && value.active == active) {
            state = ServiceResourceState(value: value);
            changed();
            return true;
          }
        } catch (_) {
          /* Reload is explicit; never replay the availability request. */
        }
      }
      if (mounted) {
        state = ServiceResourceState(
          value: value,
          uncertain: uncertain,
          error: uncertain
              ? 'Chưa rõ kết quả bật/tạm ngừng. Hãy tải lại trước khi thao tác tiếp.'
              : serviceError(error),
        );
        if (sent) changed();
      }
      return false;
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}

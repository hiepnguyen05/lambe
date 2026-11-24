import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/error/app_failure.dart';

import '../data/provider_services_repository.dart';
import '../domain/provider_offering.dart';
import '../domain/service_change.dart';
import '../domain/service_change_draft.dart';
import 'service_resource_state.dart';
import 'service_operation.dart';

class NewServiceChangeController
    extends StateNotifier<ServiceResourceState<ServiceChange>> {
  final ProviderServicesRepository repository;
  final void Function() changed;
  final cancel = CancelToken();
  ServiceChangeDraft? _attempt;
  NewServiceChangeController(this.repository, {required this.changed})
    : super(const ServiceResourceState());
  Future<ServiceChange?> create(
    ServiceChangeDraft draft,
    ServiceDefinition? definition,
  ) async {
    if (state.blocked || state.value != null) return null;
    var sent = false;
    state = const ServiceResourceState(busy: true);
    try {
      final invalid = draft.validate(definition: definition);
      if (invalid != null) throw ValidationFailure(invalid);
      if (draft.type == ServiceChangeType.updateOffering) {
        final fresh = await repository.offering(draft.offeringId!, cancel);
        final invalid = draft.validate(definition: fresh.service);
        if (invalid != null) throw ValidationFailure(invalid);
      } else if (draft.type == ServiceChangeType.addExisting) {
        if (definition?.slug == null) {
          throw const ValidationFailure('Hãy tải lại danh sách dịch vụ.');
        }
        final fresh = await repository.catalogService(
          definition!.slug!,
          cancel,
        );
        if (fresh.id != draft.serviceId) {
          throw const ValidationFailure('Dịch vụ đã thay đổi. Hãy chọn lại.');
        }
        final invalid = draft.validate(definition: fresh);
        if (invalid != null) throw ValidationFailure(invalid);
      }
      if (!mounted) return null;
      _attempt = draft;
      sent = true;
      final result = await repository.create(draft, cancel);
      if (!mounted) return null;
      state = ServiceResourceState(value: result);
      changed();
      return result;
    } catch (error) {
      if (mounted) {
        state = ServiceResourceState(
          uncertain: sent && serviceOutcomeUnknown(error),
          error: serviceError(error),
        );
      }
      return null;
    }
  }

  Future<ServiceChange?> recover() async {
    final attempt = _attempt;
    if (state.busy || !state.uncertain || attempt == null) return null;
    state = const ServiceResourceState(busy: true, uncertain: true);
    try {
      final pages = await Future.wait([
        for (final status in [
          ServiceChangeStatus.draft,
          ServiceChangeStatus.pending,
          ServiceChangeStatus.needsChanges,
        ])
          repository.changes(cancel, status: status, limit: 100),
      ]);
      if (!mounted) return null;
      if (pages.any((v) => v.hasMore)) {
        throw const ServerFailure(
          'Hãy kiểm tra đề xuất trong danh sách trước khi tạo lại.',
        );
      }
      final matches = pages
          .expand((v) => v.items)
          .where(attempt.targets)
          .toList();
      if (matches.length > 1) {
        throw const ServerFailure(
          'Có nhiều đề xuất tương ứng. Hãy kiểm tra danh sách.',
        );
      }
      final found = matches.isEmpty ? null : matches.single;
      state = ServiceResourceState(
        value: found,
        error: found == null
            ? 'Chưa tìm thấy đề xuất đang mở. Bạn có thể kiểm tra thông tin rồi chủ động lưu lại.'
            : 'Đã tìm thấy đề xuất đang mở. Hãy kiểm tra nội dung trước khi gửi duyệt.',
      );
      changed();
      return found;
    } catch (error) {
      if (mounted) {
        state = ServiceResourceState(
          uncertain: true,
          error: serviceError(error),
        );
      }
      return null;
    }
  }

  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}

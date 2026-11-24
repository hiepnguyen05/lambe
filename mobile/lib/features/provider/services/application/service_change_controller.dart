import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/core/error/app_failure.dart';

import '../data/provider_services_repository.dart';
import '../data/service_change_media_repository.dart';
import '../domain/service_change.dart';
import '../domain/service_change_draft.dart';
import 'service_resource_state.dart';
import 'service_operation.dart';

class ServiceChangeController
    extends StateNotifier<ServiceResourceState<ServiceChange>> {
  final ProviderServicesRepository repository;
  final ServiceChangeMediaRepository media;
  final String id;
  final void Function() changed;
  final cancel = CancelToken();
  bool _pickingDocument = false;
  bool get isApproved => state.value?.status == ServiceChangeStatus.approved;
  String? get providerOfferingId => state.value?.offeringId;
  ServiceChangeController(
    this.repository,
    this.media,
    this.id, {
    required this.changed,
  }) : super(const ServiceResourceState());
  Future<void> load() async {
    if (state.busy || _pickingDocument) return;
    final previous = state;
    state = ServiceResourceState(
      value: previous.value,
      busy: true,
      uncertain: previous.uncertain,
    );
    try {
      final value = await repository.change(id, cancel);
      if (mounted) {
        state = ServiceResourceState(value: value);
        if (previous.value?.status != value.status) changed();
      }
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

  Future<bool> _mutate(
    Future<ServiceChange> Function(ServiceChange) action, {
    bool withdrawing = false,
  }) async {
    if (state.blocked || _pickingDocument) return false;
    var value = state.value;
    var sent = false;
    state = ServiceResourceState(value: value, busy: true);
    try {
      value = await repository.change(id, cancel);
      if (!mounted) return false;
      if (!(withdrawing ? value.canWithdraw : value.editable)) {
        throw const ValidationFailure(
          'Đề xuất đã gửi hoặc đã được xử lý. Hãy kiểm tra trạng thái mới.',
        );
      }
      // The callback can perform additional reads/validation before sending a mutation.
      sent = true;
      final result = await action(value);
      if (!mounted) return false;
      state = ServiceResourceState(value: result);
      changed();
      return true;
    } catch (error) {
      if (!mounted) return false;
      var uncertain =
          sent && serviceOutcomeUnknown(error) && error is! ValidationFailure;
      try {
        if (sent) {
          value = await repository.change(id, cancel);
          uncertain = false;
        }
      } catch (_) {
        /* A failed read keeps all mutations disabled until explicit reload. */
      }
      if (mounted) {
        state = ServiceResourceState(
          value: value,
          uncertain: uncertain,
          error: uncertain
              ? 'Chưa rõ kết quả. Hãy tải lại trạng thái; không gửi hoặc tải ảnh lần nữa lúc này.'
              : serviceError(error),
        );
        if (sent) changed();
      }
      return false;
    }
  }

  Future<bool> update(
    ServiceChangeDraft draft,
    DateTime expectedUpdatedAt,
  ) => _mutate((current) async {
    if (current.updatedAt != expectedUpdatedAt ||
        draft.type != current.type ||
        (draft.type != ServiceChangeType.proposeNew &&
            !draft.targets(current))) {
      throw const ValidationFailure(
        'Đề xuất đã thay đổi ở nơi khác. Hãy mở lại biểu mẫu từ dữ liệu mới.',
      );
    }
    final invalid = draft.validate(definition: current.service);
    if (invalid != null) throw ValidationFailure(invalid);
    return repository.update(id, draft, cancel);
  });
  Future<bool> submit() => _mutate((_) => repository.submit(id, cancel));
  Future<bool> withdraw() =>
      _mutate((_) => repository.withdraw(id, cancel), withdrawing: true);
  Future<bool> upload(String type, XFile file) => _mutate((current) async {
    if (current.documents.length >= 10) {
      throw const ValidationFailure('Mỗi đề xuất tối đa 10 tài liệu.');
    }
    await media.upload(id, type, file, cancel);
    return repository.change(id, cancel);
  });
  Future<bool> pickAndUpload(
    String type,
    Future<XFile?> Function() pick,
  ) async {
    if (state.blocked || _pickingDocument) return false;
    _pickingDocument = true;
    try {
      final file = await pick();
      if (!mounted || file == null) return false;
      _pickingDocument = false;
      // Upload performs its own fresh state check after returning from the gallery.
      return await upload(type, file);
    } finally {
      _pickingDocument = false;
    }
  }

  Future<bool> remove(String documentId) => _mutate((current) async {
    if (!current.documents.any((v) => v.id == documentId)) {
      throw const ValidationFailure('Tài liệu không còn trong đề xuất.');
    }
    await media.remove(id, documentId, cancel);
    return repository.change(id, cancel);
  });
  @override
  void dispose() {
    cancel.cancel();
    super.dispose();
  }
}

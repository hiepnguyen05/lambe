import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/domain/value_objects/upload_payload.dart';
import '../domain/entities/provider_application_entity.dart';
import '../domain/entities/provider_application_update.dart';
import '../domain/entities/service_catalog_entity.dart';
import '../domain/repositories/partner_draft_repository.dart';
import '../domain/repositories/partner_repository.dart';

class PartnerNotifier
    extends StateNotifier<AsyncValue<ProviderApplicationEntity?>> {
  final PartnerRepository _repository;
  final PartnerDraftRepository _draftRepository;

  PartnerNotifier(this._repository, this._draftRepository)
    : super(const AsyncValue.data(null));

  Future<bool> createApplication(String providerType) async {
    state = const AsyncValue.loading();
    try {
      final application = await _repository.createApplication(providerType);
      if (mounted) state = AsyncValue.data(application);
      return true;
    } catch (error, stack) {
      if (mounted) state = AsyncValue.error(error, stack);
      return false;
    }
  }

  Future<ProviderApplicationEntity?> loadLatestApplication() async {
    state = const AsyncValue.loading();
    try {
      final application = await _repository.getLatestApplication();
      if (mounted) state = AsyncValue.data(application);
      return application;
    } catch (error, stack) {
      if (mounted) state = AsyncValue.error(error, stack);
      return null;
    }
  }

  Future<bool> updateApplication(ProviderApplicationUpdate update) {
    return _mutateAndReload(
      (id) => _repository.updateApplication(id, update),
      onSuccess: _draftRepository.clear,
    );
  }

  Future<void> saveInfoDraft(ProviderApplicationUpdate draft) async {
    final application = state.valueOrNull;
    if (application != null) {
      await _draftRepository.save(application.id, draft);
    }
  }

  Future<ProviderApplicationUpdate?> loadInfoDraft() async {
    final application = state.valueOrNull;
    return application == null ? null : _draftRepository.load(application.id);
  }

  Future<bool> addServices(List<ProviderServiceInput> services) {
    return _mutateAndReload((id) => _repository.addServices(id, services));
  }

  Future<bool> addServicesAndSuggestions(
    List<ProviderServiceInput> services,
    List<ServiceSuggestionInput> suggestions,
  ) {
    return _mutateAndReload((id) async {
      if (services.isNotEmpty) {
        await _repository.addServices(id, services);
      }
      for (final suggestion in suggestions) {
        await _repository.suggestService(id, suggestion);
      }
    });
  }

  Future<bool> suggestService(ServiceSuggestionInput suggestion) {
    return _mutateAndReload((id) => _repository.suggestService(id, suggestion));
  }

  Future<bool> uploadDocument(String type, UploadPayload upload) {
    return _mutateAndReload(
      (id) => _repository.uploadDocument(id, type, upload),
    );
  }

  Future<bool> submitApplication() {
    return _mutateAndReload((id) async {
      await _repository.acceptTerms(id);
      await _repository.submitApplication(id);
    });
  }

  Future<bool> _mutateAndReload(
    Future<void> Function(String id) mutation, {
    Future<void> Function(String id)? onSuccess,
  }) async {
    final previous = state.value;
    if (previous == null) return false;

    state = const AsyncValue.loading();
    try {
      await mutation(previous.id);
      await onSuccess?.call(previous.id);
      final application = await _repository.getApplication(previous.id);
      if (mounted) state = AsyncValue.data(application);
      return true;
    } catch (error, stack) {
      if (mounted) {
        state = AsyncValue<ProviderApplicationEntity?>.error(
          error,
          stack,
        ).copyWithPrevious(AsyncValue.data(previous));
      }
      return false;
    }
  }
}

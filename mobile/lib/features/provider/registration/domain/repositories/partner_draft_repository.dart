import '../entities/provider_application_update.dart';

abstract interface class PartnerDraftRepository {
  Future<void> save(String applicationId, ProviderApplicationUpdate draft);
  Future<ProviderApplicationUpdate?> load(String applicationId);
  Future<void> clear(String applicationId);
}

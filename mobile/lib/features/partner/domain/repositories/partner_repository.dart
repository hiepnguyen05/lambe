import '../../../../core/domain/value_objects/upload_payload.dart';
import '../entities/provider_application_entity.dart';
import '../entities/provider_application_update.dart';
import '../entities/service_catalog_entity.dart';

abstract class PartnerRepository {
  Future<ProviderApplicationEntity> createApplication(String providerType);
  Future<ProviderApplicationEntity> getApplication(String id);
  Future<List<ProviderApplicationEntity>> getMyApplications();
  Future<ProviderApplicationEntity?> getLatestApplication();
  Future<List<ServiceCatalogEntity>> getAllServices();
  Future<void> updateApplication(String id, ProviderApplicationUpdate update);
  Future<void> addServices(String id, List<ProviderServiceInput> services);
  Future<void> suggestService(String id, ServiceSuggestionInput suggestion);
  Future<void> uploadDocument(String id, String type, UploadPayload upload);
  Future<void> acceptTerms(String id);
  Future<void> submitApplication(String id);
}

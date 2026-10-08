import '../../../../core/domain/value_objects/upload_payload.dart';
import '../../domain/entities/provider_application_entity.dart';
import '../../domain/entities/provider_application_update.dart';
import '../../domain/entities/service_catalog_entity.dart';
import '../../domain/repositories/partner_repository.dart';
import '../datasources/partner_remote_datasource.dart';
import '../models/partner_api_model.dart';

class PartnerRepositoryImpl implements PartnerRepository {
  final PartnerRemoteDataSource remoteDataSource;

  PartnerRepositoryImpl(this.remoteDataSource);

  @override
  Future<ProviderApplicationEntity> createApplication(
    String providerType,
  ) async {
    final data = await remoteDataSource.createApplication(providerType);
    return PartnerApiModel.applicationFromJson(data);
  }

  @override
  Future<ProviderApplicationEntity> getApplication(String id) async {
    final data = await remoteDataSource.getApplication(id);
    return PartnerApiModel.applicationFromJson(data);
  }

  @override
  Future<List<ProviderApplicationEntity>> getMyApplications() async {
    final list = await remoteDataSource.getMyApplications();
    return list
        .map(
          (item) => PartnerApiModel.applicationFromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  @override
  Future<ProviderApplicationEntity?> getLatestApplication() async {
    final applications = await getMyApplications();
    if (applications.isEmpty) return null;
    return getApplication(applications.first.id);
  }

  @override
  Future<List<ServiceCatalogEntity>> getAllServices() async {
    final list = await remoteDataSource.getAllServices();
    return list
        .map(
          (item) => PartnerApiModel.serviceFromJson(
            Map<String, dynamic>.from(item as Map),
          ),
        )
        .toList();
  }

  @override
  Future<void> updateApplication(
    String id,
    ProviderApplicationUpdate update,
  ) async {
    await remoteDataSource.updateApplication(
      id,
      PartnerApiModel.applicationUpdateToJson(update),
    );
  }

  @override
  Future<void> addServices(
    String id,
    List<ProviderServiceInput> services,
  ) async {
    for (final service in services) {
      await remoteDataSource.addService(
        id,
        PartnerApiModel.providerServiceToJson(service),
      );
    }
  }

  @override
  Future<void> suggestService(
    String id,
    ServiceSuggestionInput suggestion,
  ) async {
    await remoteDataSource.suggestService(
      id,
      PartnerApiModel.serviceSuggestionToJson(suggestion),
    );
  }

  @override
  Future<void> uploadDocument(
    String id,
    String type,
    UploadPayload upload,
  ) async {
    await remoteDataSource.uploadDocument(id, type, upload);
  }

  @override
  Future<void> acceptTerms(String id) async {
    await remoteDataSource.acceptTerms(id);
  }

  @override
  Future<void> submitApplication(String id) async {
    await remoteDataSource.submitApplication(id);
  }
}

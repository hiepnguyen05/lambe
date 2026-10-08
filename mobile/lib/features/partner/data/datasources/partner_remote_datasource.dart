import '../../../../core/domain/value_objects/upload_payload.dart';

abstract interface class PartnerRemoteDataSource {
  Future<Map<String, dynamic>> createApplication(String providerType);
  Future<Map<String, dynamic>> getApplication(String id);
  Future<List<dynamic>> getMyApplications();
  Future<List<dynamic>> getAllServices();
  Future<void> updateApplication(String id, Map<String, dynamic> data);
  Future<void> addService(String id, Map<String, dynamic> service);
  Future<void> suggestService(String id, Map<String, dynamic> data);
  Future<void> uploadDocument(String id, String type, UploadPayload upload);
  Future<void> acceptTerms(String id);
  Future<void> submitApplication(String id);
}

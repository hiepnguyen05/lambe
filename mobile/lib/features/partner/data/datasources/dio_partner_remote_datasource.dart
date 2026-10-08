import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/domain/value_objects/upload_payload.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../../../core/network/network_exceptions.dart';
import 'partner_remote_datasource.dart';

class DioPartnerRemoteDataSource implements PartnerRemoteDataSource {
  final Dio _dio;

  DioPartnerRemoteDataSource(this._dio);

  @override
  Future<Map<String, dynamic>> createApplication(String providerType) {
    return _mapRequest(
      () => _dio.post(
        ApiEndpoints.providerApplications,
        data: {'providerType': providerType},
      ),
    );
  }

  @override
  Future<Map<String, dynamic>> getApplication(String id) {
    return _mapRequest(() => _dio.get(ApiEndpoints.providerApplication(id)));
  }

  @override
  Future<List<dynamic>> getMyApplications() {
    return _listRequest(() => _dio.get(ApiEndpoints.providerApplications));
  }

  @override
  Future<List<dynamic>> getAllServices() {
    return _listRequest(() => _dio.get(ApiEndpoints.services));
  }

  @override
  Future<void> updateApplication(String id, Map<String, dynamic> data) {
    return _voidRequest(
      () => _dio.patch(ApiEndpoints.providerApplication(id), data: data),
    );
  }

  @override
  Future<void> addService(String id, Map<String, dynamic> service) {
    return _voidRequest(
      () => _dio.post(
        ApiEndpoints.providerApplicationServices(id),
        data: service,
      ),
    );
  }

  @override
  Future<void> suggestService(String id, Map<String, dynamic> data) {
    return _voidRequest(
      () => _dio.post(ApiEndpoints.providerServiceSuggestions(id), data: data),
    );
  }

  @override
  Future<void> uploadDocument(String id, String type, UploadPayload upload) {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(upload.bytes, filename: upload.fileName),
    });
    return _voidRequest(
      () => _dio.post(ApiEndpoints.providerDocument(id, type), data: formData),
    );
  }

  @override
  Future<void> acceptTerms(String id) {
    return _voidRequest(
      () => _dio.post(ApiEndpoints.providerTerms(id), data: {'accepted': true}),
    );
  }

  @override
  Future<void> submitApplication(String id) {
    return _voidRequest(() => _dio.post(ApiEndpoints.providerSubmit(id)));
  }

  Future<Map<String, dynamic>> _mapRequest(
    Future<Response<dynamic>> Function() request,
  ) async {
    try {
      return ApiResponseParser.dataMap(await request());
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  Future<List<dynamic>> _listRequest(
    Future<Response<dynamic>> Function() request,
  ) async {
    try {
      return ApiResponseParser.dataList(await request());
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }

  Future<void> _voidRequest(
    Future<Response<dynamic>> Function() request,
  ) async {
    try {
      ApiResponseParser.ensureSuccess(await request());
    } on DioException catch (error) {
      throw ExceptionHandler.handleDioError(error);
    }
  }
}

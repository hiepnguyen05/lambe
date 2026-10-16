import 'package:dio/dio.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../domain/entities/service_filter_params.dart';
import '../models/service_item_model.dart';

abstract class CatalogRemoteDataSource {
  Future<List<ServiceItemModel>> getServices(ServiceFilterParams params);
  Future<ServiceItemModel> getServiceBySlug(String slug);
}

class CatalogRemoteDataSourceImpl implements CatalogRemoteDataSource {
  final Dio _dio;

  CatalogRemoteDataSourceImpl(this._dio);

  @override
  Future<List<ServiceItemModel>> getServices(ServiceFilterParams params) async {
    final response = await _dio.get(
      ApiEndpoints.services,
      queryParameters: params.toQueryParams(),
    );

    final list = ApiResponseParser.dataList(response);
    return list
        .map((e) => ServiceItemModel.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  }

  @override
  Future<ServiceItemModel> getServiceBySlug(String slug) async {
    final response = await _dio.get('${ApiEndpoints.services}/$slug');
    final map = ApiResponseParser.dataMap(response);
    return ServiceItemModel.fromJson(map);
  }
}

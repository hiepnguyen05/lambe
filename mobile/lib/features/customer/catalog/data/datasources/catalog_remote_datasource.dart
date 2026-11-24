import 'package:dio/dio.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../../domain/entities/service_filter_params.dart';
import '../../domain/entities/service_item_entity.dart';

abstract class CatalogRemoteDataSource {
  Future<List<ServiceItemEntity>> getServices(ServiceFilterParams params);
  Future<ServiceItemEntity> getServiceBySlug(String slug);
}

class CatalogRemoteDataSourceImpl implements CatalogRemoteDataSource {
  final Dio _dio;

  CatalogRemoteDataSourceImpl(this._dio);

  @override
  Future<List<ServiceItemEntity>> getServices(
    ServiceFilterParams params,
  ) async {
    final response = await _dio.get(
      ApiEndpoints.services,
      queryParameters: params.toQueryParams(),
    );

    final list = ApiResponseParser.dataList(response);
    return list
        .map(
          (e) =>
              ServiceItemEntity.fromJson(Map<String, dynamic>.from(e as Map)),
        )
        .toList();
  }

  @override
  Future<ServiceItemEntity> getServiceBySlug(String slug) async {
    final response = await _dio.get('${ApiEndpoints.services}/$slug');
    final map = ApiResponseParser.dataMap(response);
    return ServiceItemEntity.fromJson(map);
  }
}

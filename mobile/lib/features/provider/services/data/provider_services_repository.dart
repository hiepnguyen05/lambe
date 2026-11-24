import 'package:dio/dio.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../domain/provider_offering.dart';
import '../domain/service_change.dart';
import '../domain/service_change_draft.dart';
import 'provider_service_mapper.dart';

class ProviderServicesRepository {
  static const offeringsPath = '/me/provider/services';
  static const changesPath = '/me/provider/service-change-requests';
  final Dio dio;
  ProviderServicesRepository(this.dio);
  Future<List<ProviderOffering>> offerings(CancelToken cancel) async =>
      ApiResponseParser.dataList(
        await dio.get(offeringsPath, cancelToken: cancel),
      ).map((v) => offeringFromJson(objectMap(v))).toList(growable: false);
  ProviderOffering _offering(Response response, String id) {
    final value = offeringFromJson(ApiResponseParser.dataMap(response));
    if (value.id != id) {
      throw const FormatException('Phản hồi không khớp dịch vụ.');
    }
    return value;
  }

  Future<ProviderOffering> offering(String id, CancelToken cancel) async =>
      _offering(await dio.get('$offeringsPath/$id', cancelToken: cancel), id);
  Future<ProviderOffering> availability(
    String id,
    bool active,
    CancelToken cancel,
  ) async => _offering(
    await dio.put(
      '$offeringsPath/$id/availability',
      data: {'active': active},
      cancelToken: cancel,
    ),
    id,
  );
  Future<List<ServiceDefinition>> catalog(CancelToken cancel) async =>
      ApiResponseParser.dataList(
        await dio.get('/services', cancelToken: cancel),
      ).map((v) => definitionFromJson(objectMap(v))).toList(growable: false);
  Future<ServiceDefinition> catalogService(
    String slug,
    CancelToken cancel,
  ) async => definitionFromJson(
    ApiResponseParser.dataMap(
      await dio.get(
        '/services/${Uri.encodeComponent(slug)}',
        cancelToken: cancel,
      ),
    ),
  );
  Future<List<ServiceCategoryOption>> categories(CancelToken cancel) async =>
      ApiResponseParser.dataList(
        await dio.get('/categories', cancelToken: cancel),
      ).map((v) => categoryFromJson(objectMap(v))).toList(growable: false);
  Future<ServiceChangesPage> changes(
    CancelToken cancel, {
    ServiceChangeStatus? status,
    int page = 1,
    int limit = 20,
  }) async {
    final response = await dio.get(
      changesPath,
      queryParameters: {
        'page': page,
        'limit': limit,
        if (status != null) 'status': status.wire,
      },
      cancelToken: cancel,
    );
    final rows = ApiResponseParser.dataList(response)
        .map((v) => changeFromJson(objectMap(v)))
        .toList(growable: false);
    final meta = objectMap(objectMap(response.data)['meta']);
    if (meta['page'] is! int ||
        meta['totalPages'] is! int ||
        meta['page'] != page ||
        (meta['totalPages'] as int) < 0) {
      throw const FormatException('Thông tin phân trang không hợp lệ.');
    }
    return ServiceChangesPage(rows, page, meta['totalPages'] as int);
  }

  ServiceChange _change(Response response, [String? id]) {
    final value = changeFromJson(ApiResponseParser.dataMap(response));
    if (id != null && value.id != id) {
      throw const FormatException('Phản hồi không khớp đề xuất.');
    }
    return value;
  }

  Future<ServiceChange> change(String id, CancelToken cancel) async =>
      _change(await dio.get('$changesPath/$id', cancelToken: cancel), id);
  Future<ServiceChange> create(
    ServiceChangeDraft draft,
    CancelToken cancel,
  ) async => _change(
    await dio.post(
      changesPath,
      data: draftToJson(draft, creating: true),
      cancelToken: cancel,
    ),
  );
  Future<ServiceChange> update(
    String id,
    ServiceChangeDraft draft,
    CancelToken cancel,
  ) async => _change(
    await dio.patch(
      '$changesPath/$id',
      data: draftToJson(draft),
      cancelToken: cancel,
    ),
    id,
  );
  Future<ServiceChange> submit(String id, CancelToken cancel) async => _change(
    await dio.post('$changesPath/$id/submit', cancelToken: cancel),
    id,
  );
  Future<ServiceChange> withdraw(String id, CancelToken cancel) async =>
      _change(
        await dio.post('$changesPath/$id/withdraw', cancelToken: cancel),
        id,
      );
}

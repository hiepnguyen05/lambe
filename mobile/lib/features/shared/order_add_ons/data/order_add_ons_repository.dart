import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';

import '../domain/order_add_on.dart';
import '../domain/add_on_order.dart';

final orderAddOnsRepositoryProvider = Provider(
  (ref) => OrderAddOnsRepository(ref.watch(dioProvider)),
);

class AddOnOutcome {
  final bool success;
  final Map<String, dynamic>? orderJson;
  const AddOnOutcome(this.success, {this.orderJson});
}

class OrderAddOnsRepository {
  final Dio dio;
  OrderAddOnsRepository(this.dio);
  Future<AddOnOrder> read(AddOnScope scope, CancelToken cancel) async =>
      AddOnOrder.fromJson(
        ApiResponseParser.dataMap(
          await dio.get(scope.path, cancelToken: cancel),
        ),
      );
  Future<List<AddOnOption>> options(
    AddOnScope scope,
    CancelToken cancel,
  ) async =>
      ApiResponseParser.dataList(
            await dio.get('${scope.path}/add-on-options', cancelToken: cancel),
          )
          .map(
            (row) =>
                AddOnOption.fromJson(Map<String, dynamic>.from(row as Map)),
          )
          .toList(growable: false);
  Future<OrderAddOn> propose(
    AddOnScope scope,
    String serviceId,
    String? note,
    String key,
    CancelToken cancel,
  ) async => OrderAddOn.fromJson(
    ApiResponseParser.dataMap(
      await dio.post(
        '${scope.path}/add-ons',
        data: {'providerServiceId': serviceId, if (note != null) 'note': note},
        options: Options(headers: {'Idempotency-Key': key}),
        cancelToken: cancel,
      ),
    ),
  );
  Future<OrderAddOn> withdraw(
    AddOnScope scope,
    String id,
    CancelToken cancel,
  ) async => OrderAddOn.fromJson(
    ApiResponseParser.dataMap(
      await dio.post('${scope.path}/add-ons/$id/cancel', cancelToken: cancel),
    ),
  );
  Future<Map<String, dynamic>> decide(
    AddOnScope scope,
    String id,
    bool approve,
    CancelToken cancel,
  ) async {
    final data = ApiResponseParser.dataMap(
      await dio.post(
        '${scope.path}/add-ons/$id/decision',
        data: {'approve': approve},
        cancelToken: cancel,
      ),
    );
    final order = Map<String, dynamic>.from(data['order'] as Map);
    AddOnOrder.fromJson(
      order,
    ); // Reject malformed totals instead of calculating a replacement.
    return order;
  }
}

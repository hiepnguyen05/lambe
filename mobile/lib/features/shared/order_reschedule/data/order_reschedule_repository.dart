import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';

import '../domain/order_reschedule.dart';

final orderRescheduleRepositoryProvider = Provider(
  (ref) => OrderRescheduleRepository(ref.watch(dioProvider)),
);

class OrderRescheduleRepository {
  final Dio dio;
  OrderRescheduleRepository(this.dio);
  Future<RescheduleOrder> read(
    RescheduleScope scope,
    CancelToken cancel,
  ) async => RescheduleOrder.fromJson(
    ApiResponseParser.dataMap(
      await dio.get(scope.orderPath, cancelToken: cancel),
    ),
  );
  Future<RescheduleProposal> request(
    RescheduleScope scope,
    DateTime time,
    CancelToken cancel,
  ) async => RescheduleProposal.fromJson(
    ApiResponseParser.dataMap(
      await dio.post(
        '${scope.orderPath}/reschedule',
        data: {'scheduledAt': time.toUtc().toIso8601String()},
        cancelToken: cancel,
      ),
    ),
  );
  Future<RescheduleProposal> decide(
    RescheduleScope scope,
    String requestId,
    bool approve,
    CancelToken cancel,
  ) async => RescheduleProposal.fromJson(
    ApiResponseParser.dataMap(
      await dio.post(
        '${scope.orderPath}/reschedule/decision',
        data: {'requestId': requestId, 'approve': approve},
        cancelToken: cancel,
      ),
    ),
  );
}

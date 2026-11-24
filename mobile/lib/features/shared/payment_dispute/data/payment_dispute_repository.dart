import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';

import '../domain/payment_dispute_order.dart';

final paymentDisputeRepositoryProvider = Provider(
  (ref) => PaymentDisputeRepository(ref.watch(dioProvider)),
);

class PaymentDisputeRepository {
  final Dio dio;
  PaymentDisputeRepository(this.dio);
  Map<String, dynamic> _order(
    Response<dynamic> response,
    PaymentDisputeScope scope,
  ) {
    final json = ApiResponseParser.dataMap(response);
    final order = PaymentDisputeOrder.fromJson(json);
    if (order.id != scope.orderId) {
      throw const FormatException('Phản hồi không khớp đơn.');
    }
    return json;
  }

  Future<Map<String, dynamic>> read(
    PaymentDisputeScope scope,
    CancelToken cancel,
  ) async => _order(await dio.get(scope.path, cancelToken: cancel), scope);
  Future<Map<String, dynamic>> open(
    PaymentDisputeScope scope,
    String reason,
    CancelToken cancel,
  ) async {
    if (scope.role != PaymentDisputeRole.provider) {
      throw ArgumentError('Chỉ phía đối tác có thể gửi báo cáo thanh toán.');
    }
    return _order(
      await dio.post(
        ApiEndpoints.providerOrderPaymentDispute(scope.orderId),
        data: {'reason': reason.trim()},
        cancelToken: cancel,
      ),
      scope,
    );
  }
}

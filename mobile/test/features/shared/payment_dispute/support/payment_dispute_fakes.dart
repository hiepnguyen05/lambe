import 'package:dio/dio.dart';
import 'package:mobile/features/shared/payment_dispute/data/payment_dispute_repository.dart';
import 'package:mobile/features/shared/payment_dispute/domain/payment_dispute_order.dart';

const providerScope = PaymentDisputeScope('order', PaymentDisputeRole.provider);
const customerScope = PaymentDisputeScope('order', PaymentDisputeRole.customer);
const reason = 'Khách chỉ thanh toán một phần tiền mặt.';
Map<String, dynamic> orderJson({String status = 'IN_PROGRESS'}) => {
  'id': 'order',
  'status': status,
  'bookingType': 'ASAP',
  'totalAmount': 200000,
  'currencyCode': 'VND',
  'commissionHold': {
    'amount': 30000,
    'status': status == 'COMPLETED' ? 'CAPTURED' : 'ACTIVE',
  },
  'evidence': [
    {'id': 'after', 'type': 'AFTER_WORK'},
  ],
  'updatedAt': status == 'IN_PROGRESS'
      ? '2026-11-02T07:00:00Z'
      : '2026-11-02T08:00:00Z',
  if (status != 'IN_PROGRESS') ...{
    'paymentDisputeReason': reason,
    'paymentDisputeOpenedAt': '2026-11-02T08:00:00Z',
    if (status != 'PAYMENT_DISPUTE')
      'paymentDisputeDecidedAt': '2026-11-02T08:30:00Z',
  },
};
DioException timeout() => DioException(
  requestOptions: RequestOptions(),
  type: DioExceptionType.receiveTimeout,
);

class FakeDisputeRepository extends PaymentDisputeRepository {
  FakeDisputeRepository() : super(Dio());
  Map<String, dynamic> current = orderJson();
  int reads = 0, posts = 0;
  String? sentReason;
  Future<Map<String, dynamic>> Function()? onRead, onOpen;
  @override
  Future<Map<String, dynamic>> read(
    PaymentDisputeScope scope,
    CancelToken cancel,
  ) async {
    reads++;
    return onRead != null ? await onRead!() : current;
  }

  @override
  Future<Map<String, dynamic>> open(
    PaymentDisputeScope scope,
    String reason,
    CancelToken cancel,
  ) async {
    posts++;
    sentReason = reason;
    if (onOpen != null) return onOpen!();
    return current = orderJson(status: 'PAYMENT_DISPUTE');
  }
}

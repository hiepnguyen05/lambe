import 'package:dio/dio.dart';
import 'package:mobile/features/shared/order_add_ons/data/order_add_ons_repository.dart';
import 'package:mobile/features/shared/order_add_ons/domain/add_on_order.dart';
import 'package:mobile/features/shared/order_add_ons/domain/order_add_on.dart';

final now = DateTime.utc(2026, 11, 2);
const customerScope = AddOnScope('order', AddOnRole.customer);
const providerScope = AddOnScope('order', AddOnRole.provider);
Map<String, dynamic> addOnJson({
  String id = 'extra',
  String status = 'PENDING',
  DateTime? expires,
}) => {
  'id': id,
  'providerServiceId': 'offering-extra',
  'serviceName': 'Nhuộm tóc',
  'status': status,
  'priceAmount': 40000,
  'durationMinutes': 20,
  'commissionAmount': 6000,
  'proposedTotalAmount': 178000,
  'proposedEndAt': now
      .add(const Duration(hours: 1, minutes: 20))
      .toIso8601String(),
  'expiresAt': (expires ?? now.add(const Duration(minutes: 10)))
      .toUtc()
      .toIso8601String(),
  'createdAt': now.toIso8601String(),
  'respondedAt': status == 'PENDING'
      ? null
      : now.add(const Duration(seconds: 1)).toIso8601String(),
  'confirmedEndAt': status == 'ACCEPTED'
      ? now.add(const Duration(hours: 1, minutes: 20)).toIso8601String()
      : null,
  'note': 'Màu nâu',
};
Map<String, dynamic> orderJson({
  List<Map<String, dynamic>> items = const [],
  String status = 'IN_PROGRESS',
  String? cancellation,
}) => {
  'id': 'order',
  'status': status,
  'bookingType': 'ASAP',
  'serviceName': 'Cắt tóc',
  'currencyCode': 'VND',
  'servicePriceAmount': 120000,
  'travelFeeAmount': 23000,
  'discountAmount': 5000,
  'subtotalAmount': 143000,
  'totalAmount': 138000,
  'durationMinutes': 60,
  'commissionAmount': 18000,
  'expectedEndAt': now.add(const Duration(hours: 1)).toIso8601String(),
  'updatedAt': now.subtract(const Duration(minutes: 1)).toIso8601String(),
  'addOns': items,
  if (cancellation != null) 'cancellationRequest': {'status': cancellation},
};
Map<String, dynamic> optionJson({bool available = true, int price = 40000}) => {
  'providerServiceId': 'offering-extra',
  'serviceName': 'Nhuộm tóc',
  'priceAmount': price,
  'durationMinutes': 20,
  'commissionAmount': 6000,
  'proposedTotalAmount': 178000,
  'proposedEndAt': now
      .add(const Duration(hours: 1, minutes: 20))
      .toIso8601String(),
  'available': available,
  'reason': available ? null : 'PROVIDER_TIME_CONFLICT',
};
OrderAddOn item({String status = 'PENDING', DateTime? expires}) =>
    OrderAddOn.fromJson(addOnJson(status: status, expires: expires));
AddOnOption option({bool available = true, int price = 40000}) =>
    AddOnOption.fromJson(optionJson(available: available, price: price));
DioException requestFailure({int? status}) => DioException(
  requestOptions: RequestOptions(),
  type: status == null
      ? DioExceptionType.receiveTimeout
      : DioExceptionType.badResponse,
  response: status == null
      ? null
      : Response(
          requestOptions: RequestOptions(),
          statusCode: status,
          data: {'message': 'Lịch hoặc ví đã thay đổi.'},
        ),
);

class FakeAddOnsRepository extends OrderAddOnsRepository {
  FakeAddOnsRepository() : super(Dio());
  Map<String, dynamic> current = orderJson();
  List<AddOnOption> available = [option()];
  int reads = 0,
      optionsReads = 0,
      proposals = 0,
      decisions = 0,
      withdrawals = 0;
  final keys = <String>[];
  String? sentNote;
  Future<AddOnOrder> Function()? onRead;
  Future<OrderAddOn> Function()? onPropose;
  Future<Map<String, dynamic>> Function(bool)? onDecide;
  @override
  Future<AddOnOrder> read(AddOnScope scope, CancelToken cancel) async {
    reads++;
    return onRead != null ? onRead!() : AddOnOrder.fromJson(current);
  }

  @override
  Future<List<AddOnOption>> options(
    AddOnScope scope,
    CancelToken cancel,
  ) async {
    optionsReads++;
    return available;
  }

  @override
  Future<OrderAddOn> propose(
    AddOnScope scope,
    String serviceId,
    String? note,
    String key,
    CancelToken cancel,
  ) async {
    proposals++;
    keys.add(key);
    sentNote = note;
    if (onPropose != null) return onPropose!();
    final json = addOnJson()..['note'] = note;
    current = {
      ...current,
      'addOns': [json],
    };
    return OrderAddOn.fromJson(json);
  }

  @override
  Future<Map<String, dynamic>> decide(
    AddOnScope scope,
    String id,
    bool approve,
    CancelToken cancel,
  ) async {
    decisions++;
    if (onDecide != null) return onDecide!(approve);
    current = {
      ...current,
      'addOns': [addOnJson(status: approve ? 'ACCEPTED' : 'REJECTED')],
      'totalAmount': approve ? 178000 : 138000,
      'commissionAmount': approve ? 24000 : 18000,
      'durationMinutes': approve ? 80 : 60,
      'updatedAt': now.add(const Duration(seconds: 1)).toIso8601String(),
    };
    return current;
  }

  @override
  Future<OrderAddOn> withdraw(
    AddOnScope scope,
    String id,
    CancelToken cancel,
  ) async {
    withdrawals++;
    final value = addOnJson(status: 'CANCELLED');
    current = {
      ...current,
      'addOns': [value],
    };
    return OrderAddOn.fromJson(value);
  }
}

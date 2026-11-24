import 'package:dio/dio.dart';
import 'package:mobile/features/shared/order_reschedule/data/order_reschedule_repository.dart';
import 'package:mobile/features/shared/order_reschedule/domain/order_reschedule.dart';

final now = DateTime.utc(2026, 11, 2);
const customerScope = RescheduleScope('order', RescheduleRole.customer);
const providerScope = RescheduleScope('order', RescheduleRole.provider);
RescheduleProposal proposal({
  String id = 'request',
  String status = 'PENDING',
  DateTime? expires,
  DateTime? start,
}) => RescheduleProposal(
  id: id,
  status: status,
  startAt: start ?? now.add(const Duration(hours: 4)),
  endAt: (start ?? now.add(const Duration(hours: 4))).add(
    const Duration(hours: 1),
  ),
  expiresAt: expires ?? now.add(const Duration(minutes: 30)),
  createdAt: now,
  respondedAt: status == 'PENDING' ? null : now.add(const Duration(minutes: 1)),
);
RescheduleOrder order({
  RescheduleProposal? request,
  String status = 'ACCEPTED',
  String type = 'SCHEDULED',
}) => RescheduleOrder(
  id: 'order',
  status: status,
  bookingType: type,
  startAt: now.add(const Duration(hours: 2)),
  updatedAt: now.subtract(const Duration(hours: 1)),
  proposal: request,
);

class FakeRescheduleRepository extends OrderRescheduleRepository {
  FakeRescheduleRepository() : super(Dio());
  RescheduleOrder current = order();
  int reads = 0;
  int requests = 0;
  int decisions = 0;
  Future<RescheduleOrder> Function()? onRead;
  Future<RescheduleProposal> Function(DateTime)? onRequest;
  Future<RescheduleProposal> Function(String, bool)? onDecide;
  @override
  Future<RescheduleOrder> read(
    RescheduleScope scope,
    CancelToken cancel,
  ) async {
    reads++;
    return onRead != null ? onRead!() : current;
  }

  @override
  Future<RescheduleProposal> request(
    RescheduleScope scope,
    DateTime time,
    CancelToken cancel,
  ) async {
    requests++;
    if (onRequest != null) return onRequest!(time);
    final result = proposal(start: time);
    current = order(request: result);
    return result;
  }

  @override
  Future<RescheduleProposal> decide(
    RescheduleScope scope,
    String id,
    bool approve,
    CancelToken cancel,
  ) async {
    decisions++;
    if (onDecide != null) return onDecide!(id, approve);
    final result = proposal(id: id, status: approve ? 'ACCEPTED' : 'REJECTED');
    current = RescheduleOrder(
      id: 'order',
      status: 'ACCEPTED',
      bookingType: 'SCHEDULED',
      startAt: approve ? result.startAt : current.startAt,
      updatedAt: now.add(const Duration(minutes: 1)),
      proposal: result,
    );
    return result;
  }
}

DioException failure({int? status}) => DioException(
  requestOptions: RequestOptions(),
  type: status == null
      ? DioExceptionType.receiveTimeout
      : DioExceptionType.badResponse,
  response: status == null
      ? null
      : Response(
          requestOptions: RequestOptions(),
          statusCode: status,
          data: {'message': 'Lịch bị trùng.'},
        ),
);

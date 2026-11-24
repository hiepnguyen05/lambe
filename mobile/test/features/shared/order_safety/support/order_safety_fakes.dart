import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/features/shared/order_safety/data/order_safety_repository.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';

const scope = SafetyScope('order-1', SafetyRole.customer);
const own = SafetyIncident(id: 'incident', status: 'OPEN', ownReport: true);
const other = SafetyIncident(id: 'incident', status: 'OPEN');
const closed = SafetyIncident(
  id: 'incident',
  status: 'CLOSED',
  ownReport: true,
);
DioException offline() => DioException(
  requestOptions: RequestOptions(),
  type: DioExceptionType.receiveTimeout,
);
DioException rejected() => DioException(
  requestOptions: RequestOptions(),
  type: DioExceptionType.badResponse,
  response: Response(requestOptions: RequestOptions(), statusCode: 409),
);

class FakeSafetyRepository extends OrderSafetyRepository {
  FakeSafetyRepository() : super(Dio());
  int posts = 0;
  int gets = 0;
  int uploads = 0;
  Future<SafetyIncident> Function() onRaise = () async => own;
  Future<SafetyIncident> Function() onMine = () async => own;
  @override
  Future<SafetyIncident> raise(SafetyScope scope, CancelToken cancel) {
    posts++;
    return onRaise();
  }

  @override
  Future<SafetyIncident> mine(SafetyScope scope, CancelToken cancel) {
    gets++;
    return onMine();
  }

  @override
  Future<void> upload(SafetyScope scope, XFile file, CancelToken cancel) async {
    uploads++;
  }
}

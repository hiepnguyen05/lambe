import '../datasources/customer_orders_remote_datasource.dart';
import '../../domain/entities/customer_order_entity.dart';
import '../../domain/repositories/customer_orders_repository.dart';

class CustomerOrdersRepositoryImpl implements CustomerOrdersRepository {
  final CustomerOrdersRemoteDataSource _remoteDataSource;

  CustomerOrdersRepositoryImpl(this._remoteDataSource);

  @override
  Future<List<CustomerOrderEntity>> getMyOrders({String? status}) {
    return _remoteDataSource.getMyOrders(status: status);
  }

  @override
  Future<CustomerOrderEntity> getMyOrderById(String orderId) {
    return _remoteDataSource.getMyOrderById(orderId);
  }

  @override
  Future<CustomerOrderEntity> cancelOrder(
    String orderId, {
    required String reason,
  }) {
    return _remoteDataSource.cancelOrder(orderId, reason: reason);
  }

  @override
  Future<CustomerOrderEntity> decideCancellation(
    String orderId, {
    required bool approve,
    String? note,
  }) {
    return _remoteDataSource.decideCancellation(
      orderId,
      approve: approve,
      note: note,
    );
  }

  @override
  Future<void> submitReview(
    String orderId, {
    required int rating,
    String? comment,
  }) {
    return _remoteDataSource.submitReview(
      orderId,
      rating: rating,
      comment: comment,
    );
  }

  @override
  Future<String?> getEvidenceSignedUrl(String orderId, String evidenceId) {
    return _remoteDataSource.getEvidenceSignedUrl(orderId, evidenceId);
  }
}

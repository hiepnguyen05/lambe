import '../entities/customer_order_entity.dart';

abstract class CustomerOrdersRepository {
  Future<List<CustomerOrderEntity>> getMyOrders({String? status});
  Future<CustomerOrderEntity> getMyOrderById(String orderId);
  Future<CustomerOrderEntity> cancelOrder(
    String orderId, {
    required String reason,
  });
  Future<CustomerOrderEntity> decideCancellation(
    String orderId, {
    required bool approve,
    String? note,
  });
  Future<void> submitReview(
    String orderId, {
    required int rating,
    String? comment,
  });
  Future<String?> getEvidenceSignedUrl(String orderId, String evidenceId);
}

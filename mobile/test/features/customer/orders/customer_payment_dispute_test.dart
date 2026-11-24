import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/domain/repositories/customer_orders_repository.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';

import '../../shared/payment_dispute/support/payment_dispute_fakes.dart';

class _Repository implements CustomerOrdersRepository {
  CustomerOrderEntity current;
  int reviews = 0;
  _Repository(this.current);
  @override
  Future<CustomerOrderEntity> getMyOrderById(String id) async => current;
  @override
  Future<void> submitReview(
    String orderId, {
    required int rating,
    String? comment,
  }) async {
    reviews++;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  for (final status in ['PAYMENT_DISPUTE', 'DISPUTED']) {
    test(
      '$status is a support state, continues polling and never allows review',
      () async {
        final order = CustomerOrderEntity.fromJson(
          orderJson(status: status)..remove('commissionHold'),
        );
        expect(order.shouldPoll && order.needsSupport, isTrue);
        expect(order.isCompleted || order.canReview, isFalse);
        expect(order.paymentDispute?.reason, reason);
        final repo = _Repository(order);
        final notifier = CustomerOrderDetailNotifier(repo, 'order');
        addTearDown(notifier.dispose);
        await Future<void>.delayed(Duration.zero);
        expect(await notifier.submitReview(rating: 5), isFalse);
        expect(await notifier.cancelOrder('Hủy đơn'), isFalse);
        expect(repo.reviews, 0);
      },
    );
  }
  test('rechecks real status before submitting a review of a stale completed screen', () async {
    final repo = _Repository(
      CustomerOrderEntity.fromJson(orderJson(status: 'COMPLETED')),
    );
    final notifier = CustomerOrderDetailNotifier(repo, 'order');
    addTearDown(notifier.dispose);
    await Future<void>.delayed(Duration.zero);
    repo.current = CustomerOrderEntity.fromJson(orderJson(status: 'DISPUTED'));
    expect(await notifier.submitReview(rating: 5), isFalse);
    expect(repo.reviews, 0);
  });
  test(
    'review is allowed once the server actually confirms completion',
    () async {
      final repo = _Repository(
        CustomerOrderEntity.fromJson(orderJson(status: 'COMPLETED')),
      );
      final notifier = CustomerOrderDetailNotifier(repo, 'order');
      addTearDown(notifier.dispose);
      await Future<void>.delayed(Duration.zero);
      expect(await notifier.submitReview(rating: 5), isTrue);
      expect(repo.reviews, 1);
      expect(notifier.state.order?.shouldPoll, isFalse);
    },
  );
}

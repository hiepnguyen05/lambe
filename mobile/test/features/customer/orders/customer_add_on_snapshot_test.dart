import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/domain/repositories/customer_orders_repository.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';

import '../../shared/order_add_ons/support/add_on_fakes.dart';

class _Orders implements CustomerOrdersRepository {
  final reads = <Completer<CustomerOrderEntity>>[];
  @override
  Future<CustomerOrderEntity> getMyOrderById(String id) =>
      reads.removeAt(0).future;
  @override
  dynamic noSuchMethod(Invocation value) => super.noSuchMethod(value);
}

void main() {
  for (final approve in [false, true]) {
    test(
      'older in-flight GET cannot roll back an add-on ${approve ? 'approval' : 'rejection'} ACK',
      () async {
        final repo = _Orders();
        final initial = Completer<CustomerOrderEntity>();
        repo.reads.add(initial);
        final notifier = CustomerOrderDetailNotifier(repo, 'order');
        addTearDown(notifier.dispose);
        final before = CustomerOrderEntity.fromJson(
          orderJson(items: [addOnJson()]),
        );
        initial.complete(before);
        await Future<void>.delayed(Duration.zero);
        final slow = Completer<CustomerOrderEntity>();
        repo.reads.add(slow);
        final pending = notifier.fetchOrder(silent: true);
        final after = CustomerOrderEntity.fromJson({
          ...orderJson(
            items: [addOnJson(status: approve ? 'ACCEPTED' : 'REJECTED')],
          ),
          'totalAmount': approve ? 178000 : 138000,
        });
        notifier.applyServerOrder(after);
        expect(
          notifier.state.order?.addOnSnapshot?.items.single.status,
          approve ? 'ACCEPTED' : 'REJECTED',
        );
        slow.complete(before);
        await pending;
        expect(notifier.state.order?.totalAmount, approve ? 178000 : 138000);
        expect(
          notifier.state.order?.addOnSnapshot?.items.single.status,
          approve ? 'ACCEPTED' : 'REJECTED',
        );
      },
    );
  }
}

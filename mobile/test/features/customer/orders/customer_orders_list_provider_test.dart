import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/domain/repositories/customer_orders_repository.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';

void main() {
  test(
    'refresh keeps the previous list visible until new orders arrive',
    () async {
      final repository = _DeferredOrdersRepository();
      final first = Completer<List<CustomerOrderEntity>>();
      repository.responses.add(first);
      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(_SignedInRepository()),
          customerOrdersRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);
      final subscription = container.listen(
        customerOrdersListProvider,
        (_, __) {},
      );
      addTearDown(subscription.close);

      await Future<void>.delayed(Duration.zero);
      first.complete([_order('PENDING_PROVIDER')]);
      await container.read(customerOrdersListProvider.future);

      final next = Completer<List<CustomerOrderEntity>>();
      repository.responses.add(next);
      container.invalidate(customerOrdersListProvider);
      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(customerOrdersListProvider).valueOrNull?.single.status,
        'PENDING_PROVIDER',
      );

      next.complete([_order('ACCEPTED')]);
      await container.read(customerOrdersListProvider.future);
      expect(
        container.read(customerOrdersListProvider).valueOrNull?.single.status,
        'ACCEPTED',
      );
    },
  );
}

CustomerOrderEntity _order(String status) => CustomerOrderEntity(
  id: 'order-1',
  bookingType: 'ASAP',
  status: status,
  serviceName: 'Cắt tóc',
  servicePriceAmount: 120000,
  totalAmount: 120000,
);

class _SignedInRepository implements AuthRepository {
  @override
  Future<UserEntity?> getCurrentUser() async =>
      const UserEntity(id: 'customer-1');

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _DeferredOrdersRepository implements CustomerOrdersRepository {
  final responses = <Completer<List<CustomerOrderEntity>>>[];

  @override
  Future<List<CustomerOrderEntity>> getMyOrders({String? status}) =>
      responses.removeAt(0).future;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

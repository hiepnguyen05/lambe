import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/tracking/data/order_tracking_remote_datasource.dart';
import 'package:mobile/features/shared/tracking/domain/order_tracking_snapshot.dart';
import 'package:mobile/features/shared/tracking/presentation/order_tracking_provider.dart';

class _TrackingSource extends OrderTrackingRemoteDataSource {
  _TrackingSource() : super(Dio());

  int connections = 0;
  int cancellations = 0;

  @override
  Stream<OrderTrackingSnapshot> watch(String orderId, CancelToken cancelToken) {
    connections++;
    cancelToken.whenCancel.then((_) => cancellations++);
    return const Stream<OrderTrackingSnapshot>.empty();
  }
}

void main() {
  test('tracking closes on pause and reconnects on resume', () async {
    final source = _TrackingSource();
    final container = ProviderContainer(
      overrides: [
        orderTrackingRemoteDataSourceProvider.overrideWithValue(source),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      orderTrackingProvider('order-1'),
      (_, __) {},
    );
    addTearDown(subscription.close);
    await Future<void>.delayed(Duration.zero);
    expect(source.connections, 1);

    container.read(orderTrackingActiveProvider('order-1').notifier).state =
        false;
    await Future<void>.delayed(Duration.zero);
    expect(source.cancellations, 1);
    expect(source.connections, 1);

    container.read(orderTrackingActiveProvider('order-1').notifier).state =
        true;
    await Future<void>.delayed(Duration.zero);
    expect(source.connections, 2);
  });
}

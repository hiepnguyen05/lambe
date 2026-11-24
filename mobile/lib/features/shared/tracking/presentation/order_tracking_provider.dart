import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/dio_client.dart';

import '../data/order_tracking_remote_datasource.dart';
import '../domain/order_tracking_snapshot.dart';

final orderTrackingRemoteDataSourceProvider =
    Provider<OrderTrackingRemoteDataSource>(
      (ref) => OrderTrackingRemoteDataSource(ref.watch(dioProvider)),
    );

final orderTrackingActiveProvider = StateProvider.autoDispose
    .family<bool, String>((ref, orderId) => true);

final orderTrackingProvider = StreamProvider.autoDispose
    .family<OrderTrackingSnapshot, String>((ref, orderId) {
      if (!ref.watch(orderTrackingActiveProvider(orderId))) {
        return const Stream<OrderTrackingSnapshot>.empty();
      }
      final cancelToken = CancelToken();
      ref.onDispose(cancelToken.cancel);
      return ref
          .watch(orderTrackingRemoteDataSourceProvider)
          .watch(orderId, cancelToken);
    });

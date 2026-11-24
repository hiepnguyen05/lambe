import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../data/order_notifications_remote_datasource.dart';
import '../domain/order_notification.dart';

final orderNotificationsRemoteDataSourceProvider =
    Provider<OrderNotificationsRemoteDataSource>((ref) {
      return OrderNotificationsRemoteDataSource(ref.watch(dioProvider));
    });

final orderNotificationsProvider = FutureProvider.autoDispose
    .family<List<OrderNotification>, String>(
      (ref, userId) =>
          ref.watch(orderNotificationsRemoteDataSourceProvider).list(),
    );

final orderNotificationEventsProvider =
    StreamProvider.autoDispose<OrderNotification>((ref) {
      final userId = ref.watch(
        authNotifierProvider.select((auth) => auth.valueOrNull?.id),
      );
      if (userId == null) return const Stream.empty();
      final cancelToken = CancelToken();
      ref.onDispose(cancelToken.cancel);
      return ref
          .watch(orderNotificationsRemoteDataSourceProvider)
          .watch(cancelToken: cancelToken);
    });

import 'package:dio/dio.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import '../di/provider_workspace_providers.dart';
import '../domain/entities/provider_dashboard_entity.dart';

final providerUpcomingAppointmentsProvider =
    FutureProvider.autoDispose<List<ProviderAppointmentEntity>>((ref) async {
      final userId = ref.watch(
        authNotifierProvider.select((auth) => auth.valueOrNull?.id),
      );
      if (userId == null) return [];
      final cancel = CancelToken();
      final lifecycle = AppLifecycleListener(onResume: ref.invalidateSelf);
      ref.onDispose(() {
        cancel.cancel();
        lifecycle.dispose();
      });
      ref.listen(orderNotificationEventsProvider, (_, next) {
        if (next.valueOrNull != null) ref.invalidateSelf();
      });
      final rows = await ref
          .watch(providerOrdersRemoteDataSourceProvider)
          .getUpcomingOrders(cancelToken: cancel);
      return rows.map(ProviderAppointmentEntity.fromJson).toList();
    });

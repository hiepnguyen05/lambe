import 'package:mobile/features/provider/location/di/provider_location_providers.dart';
import 'package:mobile/features/shared/order_safety/application/order_safety_controller.dart';
import 'package:mobile/features/shared/order_safety/domain/order_safety.dart';

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/dio_client.dart';

import '../application/provider_dashboard_notifier.dart';
import '../application/provider_earnings_summary.dart';
import '../application/provider_incoming_orders_notifier.dart';
import '../data/datasources/provider_dashboard_remote_datasource.dart';
import '../data/datasources/provider_orders_remote_datasource.dart';
import '../data/repositories/provider_dashboard_repository_impl.dart';
import '../domain/entities/incoming_order_entity.dart';
import '../domain/entities/provider_dashboard_entity.dart';
import '../domain/repositories/provider_dashboard_repository.dart';
import '../application/provider_order_execution_notifier.dart';
import '../application/provider_order_execution_state.dart';
import '../application/provider_vouchers_notifier.dart';
import '../data/datasources/provider_vouchers_remote_datasource.dart';

import 'package:mobile/features/shared/auth/di/auth_providers.dart';

final providerDashboardRemoteDataSourceProvider =
    Provider<ProviderDashboardRemoteDataSource>((ref) {
      return DioProviderDashboardRemoteDataSource(ref.watch(dioProvider));
    });

final providerDashboardRepositoryProvider =
    Provider<ProviderDashboardRepository>((ref) {
      return ProviderDashboardRepositoryImpl(
        ref.watch(providerDashboardRemoteDataSourceProvider),
      );
    });

final providerDashboardProvider =
    AsyncNotifierProvider<ProviderDashboardNotifier, ProviderDashboardEntity>(
      () {
        return ProviderDashboardNotifier();
      },
    );

final providerOrdersRemoteDataSourceProvider =
    Provider<ProviderOrdersRemoteDataSource>((ref) {
      return DioProviderOrdersRemoteDataSource(ref.watch(dioProvider));
    });

final providerOrdersListProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
      final userId = ref.watch(
        authNotifierProvider.select((auth) => auth.valueOrNull?.id),
      );
      if (userId == null) return [];
      final cache = ref.keepAlive();
      Timer? eviction;
      ref.onCancel(() {
        eviction = Timer(const Duration(seconds: 30), cache.close);
      });
      ref.onResume(() => eviction?.cancel());
      ref.onDispose(() => eviction?.cancel());
      return ref
          .watch(providerOrdersRemoteDataSourceProvider)
          .getAllProviderOrders();
    });

final providerCompletedOrdersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
      final userId = ref.watch(
        authNotifierProvider.select((auth) => auth.valueOrNull?.id),
      );
      if (userId == null) return [];
      final cache = ref.keepAlive();
      Timer? eviction;
      ref.onCancel(() {
        eviction = Timer(const Duration(seconds: 30), cache.close);
      });
      ref.onResume(() => eviction?.cancel());
      ref.onDispose(() => eviction?.cancel());
      return ref
          .watch(providerOrdersRemoteDataSourceProvider)
          .getAllProviderOrders(status: 'COMPLETED');
    });

final providerEarningsProvider = Provider.autoDispose
    .family<AsyncValue<ProviderPeriodEarnings>, IncomePeriod>((ref, period) {
      final completedAsync = ref.watch(providerCompletedOrdersProvider);
      return completedAsync.whenData(
        (orders) => summarizeProviderEarnings(orders, period: period),
      );
    });

final providerOrderRefreshSignalProvider = StateProvider.autoDispose
    .family<int, String>((ref, orderId) => 0);

final providerIncomingOrdersProvider =
    StateNotifierProvider.autoDispose<
      ProviderIncomingOrdersNotifier,
      IncomingOrderEntity?
    >((ref) {
      final ds = ref.watch(providerOrdersRemoteDataSourceProvider);
      return ProviderIncomingOrdersNotifier(ds, ref);
    });

final providerVouchersRemoteDataSourceProvider =
    Provider<ProviderVouchersRemoteDataSource>((ref) {
      return DioProviderVouchersRemoteDataSource(ref.watch(dioProvider));
    });

final providerVouchersNotifierProvider =
    StateNotifierProvider.autoDispose<
      ProviderVouchersNotifier,
      ProviderVouchersState
    >((ref) {
      final ds = ref.watch(providerVouchersRemoteDataSourceProvider);
      return ProviderVouchersNotifier(ds);
    });

final providerOrderExecutionNotifierProvider = StateNotifierProvider.autoDispose
    .family<
      ProviderOrderExecutionNotifier,
      ProviderOrderExecutionState,
      String
    >((ref, orderId) {
      final ds = ref.watch(providerOrdersRemoteDataSourceProvider);
      return ProviderOrderExecutionNotifier(
        orderId: orderId,
        remoteDataSource: ds,
        ref: ref,
      );
    });

final resumeProviderTrackingProvider = FutureProvider.autoDispose<void>((
  ref,
) async {
  final authUser = ref.watch(authNotifierProvider).valueOrNull;
  if (authUser == null) return;
  var active = true;
  ref.onDispose(() => active = false);
  final ds = ref.watch(providerOrdersRemoteDataSourceProvider);
  try {
    final orders = await ds.getAllProviderOrders(status: 'EN_ROUTE');
    if (!active ||
        ref.read(authNotifierProvider).valueOrNull?.id != authUser.id) {
      return;
    }
    if (orders.isNotEmpty &&
        !ref
            .read(
              orderSafetyProvider(
                SafetyScope(orders.first['id'].toString(), SafetyRole.provider),
              ),
            )
            .blocksOrder) {
      await ref
          .read(providerLocationCoordinatorProvider)
          .start(orders.first['id'].toString());
    }
  } catch (error) {
    debugPrint(
      '⚠️ [resumeProviderTrackingProvider] Không thể tự động nối GPS: $error',
    );
  }
});

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../application/provider_dashboard_notifier.dart';
import '../application/provider_incoming_orders_notifier.dart';
import '../data/datasources/provider_dashboard_remote_datasource.dart';
import '../data/datasources/provider_orders_remote_datasource.dart';
import '../data/repositories/provider_dashboard_repository_impl.dart';
import '../domain/entities/incoming_order_entity.dart';
import '../domain/entities/provider_dashboard_entity.dart';
import '../domain/repositories/provider_dashboard_repository.dart';

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
    AsyncNotifierProvider<ProviderDashboardNotifier, ProviderDashboardEntity>(() {
  return ProviderDashboardNotifier();
});

final providerOrdersRemoteDataSourceProvider =
    Provider<ProviderOrdersRemoteDataSource>((ref) {
  return DioProviderOrdersRemoteDataSource(ref.watch(dioProvider));
});

final providerIncomingOrdersProvider =
    StateNotifierProvider.autoDispose<ProviderIncomingOrdersNotifier, IncomingOrderEntity?>((ref) {
  final ds = ref.watch(providerOrdersRemoteDataSourceProvider);
  return ProviderIncomingOrdersNotifier(ds, ref);
});

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../application/provider_schedule_notifier.dart';
import '../application/provider_schedule_state.dart';
import '../data/datasources/provider_schedule_remote_datasource.dart';
import '../data/repositories/provider_schedule_repository_impl.dart';
import '../domain/repositories/provider_schedule_repository.dart';

final providerScheduleRemoteDataSourceProvider =
    Provider<ProviderScheduleRemoteDataSource>((ref) {
  return DioProviderScheduleRemoteDataSource(ref.watch(dioProvider));
});

final providerScheduleRepositoryProvider =
    Provider<ProviderScheduleRepository>((ref) {
  return ProviderScheduleRepositoryImpl(
    ref.watch(providerScheduleRemoteDataSourceProvider),
  );
});

final providerScheduleNotifierProvider = StateNotifierProvider<
    ProviderScheduleNotifier, ProviderScheduleState>((ref) {
  return ProviderScheduleNotifier(
    ref.watch(providerScheduleRepositoryProvider),
  );
});

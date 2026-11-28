import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../application/provider_wallet_notifier.dart';
import '../application/provider_wallet_state.dart';
import '../data/datasources/provider_wallet_remote_datasource.dart';
import '../data/repositories/provider_wallet_repository_impl.dart';
import '../domain/repositories/provider_wallet_repository.dart';

final providerWalletRemoteDataSourceProvider =
    Provider<ProviderWalletRemoteDataSource>((ref) {
      final dioClient = ref.watch(dioProvider);
      return DioProviderWalletRemoteDataSource(dioClient);
    });

final providerWalletRepositoryProvider = Provider<ProviderWalletRepository>((
  ref,
) {
  final remoteDataSource = ref.watch(providerWalletRemoteDataSourceProvider);
  return ProviderWalletRepositoryImpl(remoteDataSource);
});

final providerWalletNotifierProvider =
    StateNotifierProvider<ProviderWalletNotifier, ProviderWalletState>((ref) {
      final userId = ref.watch(
        authNotifierProvider.select((s) => s.valueOrNull?.id),
      );
      final repository = ref.watch(providerWalletRepositoryProvider);
      return ProviderWalletNotifier(repository, autoLoad: userId != null);
    });

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../application/address_notifier.dart';
import '../data/datasources/dio_address_remote_datasource.dart';
import '../data/repositories/address_repository_impl.dart';
import '../domain/entities/address_entity.dart';
import '../domain/repositories/address_repository.dart';

final addressRepositoryProvider = Provider<AddressRepository>((ref) {
  return AddressRepositoryImpl(
    DioAddressRemoteDataSource(ref.watch(dioProvider)),
  );
});

final addressNotifierProvider =
    StateNotifierProvider<AddressNotifier, AsyncValue<List<AddressEntity>>>((
      ref,
    ) {
      return AddressNotifier(ref.watch(addressRepositoryProvider));
    });

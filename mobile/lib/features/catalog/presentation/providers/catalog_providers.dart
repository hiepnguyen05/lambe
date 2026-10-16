import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../../data/datasources/catalog_remote_datasource.dart';
import '../../data/repositories/catalog_repository_impl.dart';
import '../../domain/repositories/catalog_repository.dart';

final catalogRemoteDataSourceProvider = Provider<CatalogRemoteDataSource>((ref) {
  final dio = ref.watch(dioProvider);
  return CatalogRemoteDataSourceImpl(dio);
});

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  final remoteDataSource = ref.watch(catalogRemoteDataSourceProvider);
  return CatalogRepositoryImpl(remoteDataSource);
});

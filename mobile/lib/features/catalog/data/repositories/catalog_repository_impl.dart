import '../../domain/entities/service_filter_params.dart';
import '../../domain/entities/service_item_entity.dart';
import '../../domain/repositories/catalog_repository.dart';
import '../datasources/catalog_remote_datasource.dart';

class CatalogRepositoryImpl implements CatalogRepository {
  final CatalogRemoteDataSource _remoteDataSource;

  CatalogRepositoryImpl(this._remoteDataSource);

  @override
  Future<List<ServiceItemEntity>> getServices(ServiceFilterParams params) {
    return _remoteDataSource.getServices(params);
  }

  @override
  Future<ServiceItemEntity> getServiceBySlug(String slug) {
    return _remoteDataSource.getServiceBySlug(slug);
  }
}

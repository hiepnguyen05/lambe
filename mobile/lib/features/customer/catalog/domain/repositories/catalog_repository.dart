import '../entities/service_filter_params.dart';
import '../entities/service_item_entity.dart';

abstract class CatalogRepository {
  Future<List<ServiceItemEntity>> getServices(ServiceFilterParams params);
  Future<ServiceItemEntity> getServiceBySlug(String slug);
  Future<ServiceReviewsPage> getServiceReviews(
    String slug, {
    String? cursor,
    int limit = 20,
  });
}

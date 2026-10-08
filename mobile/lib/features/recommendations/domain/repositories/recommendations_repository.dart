import '../entities/service_recommendations_entity.dart';

abstract interface class RecommendationsRepository {
  Future<ServiceRecommendationsEntity> getServices({int limit = 12});
}

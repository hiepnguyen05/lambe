import '../../domain/entities/service_recommendations_entity.dart';
import '../../domain/repositories/recommendations_repository.dart';
import '../datasources/recommendations_remote_datasource.dart';
import '../models/service_recommendations_model.dart';

class RecommendationsRepositoryImpl implements RecommendationsRepository {
  final RecommendationsRemoteDataSource remoteDataSource;

  RecommendationsRepositoryImpl(this.remoteDataSource);

  @override
  Future<ServiceRecommendationsEntity> getServices({int limit = 12}) async {
    final data = await remoteDataSource.getServices(limit: limit);
    return ServiceRecommendationsModel.fromJson(data);
  }
}

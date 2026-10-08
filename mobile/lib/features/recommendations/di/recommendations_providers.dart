import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../application/recommendations_notifier.dart';
import '../data/datasources/dio_recommendations_remote_datasource.dart';
import '../data/repositories/recommendations_repository_impl.dart';
import '../domain/entities/service_recommendations_entity.dart';
import '../domain/repositories/recommendations_repository.dart';

final recommendationsRepositoryProvider = Provider<RecommendationsRepository>(
  (ref) => RecommendationsRepositoryImpl(
    DioRecommendationsRemoteDataSource(ref.watch(dioProvider)),
  ),
);

final serviceRecommendationsProvider =
    StateNotifierProvider<
      RecommendationsNotifier,
      AsyncValue<ServiceRecommendationsEntity>
    >((ref) {
      return RecommendationsNotifier(
        ref.watch(recommendationsRepositoryProvider),
      );
    });

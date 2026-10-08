import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/service_recommendations_entity.dart';
import '../domain/repositories/recommendations_repository.dart';

class RecommendationsNotifier
    extends StateNotifier<AsyncValue<ServiceRecommendationsEntity>> {
  final RecommendationsRepository _repository;

  RecommendationsNotifier(this._repository)
    : super(const AsyncValue.loading()) {
    load();
  }

  Future<void> load() async {
    state = const AsyncValue.loading();
    try {
      final recommendations = await _repository.getServices();
      if (mounted) state = AsyncValue.data(recommendations);
    } catch (error, stack) {
      if (mounted) state = AsyncValue.error(error, stack);
    }
  }
}

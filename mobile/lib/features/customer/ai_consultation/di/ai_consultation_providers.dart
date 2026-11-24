import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/dio_client.dart';

import '../application/ai_consultation_notifier.dart';
import '../data/datasources/ai_consultation_remote_datasource.dart';
import '../data/repositories/ai_consultation_repository_impl.dart';
import '../domain/repositories/ai_consultation_repository.dart';

final aiConsultationRemoteDataSourceProvider =
    Provider<AiConsultationRemoteDataSource>((ref) {
      return DioAiConsultationRemoteDataSource(ref.watch(dioProvider));
    });

final aiConsultationRepositoryProvider = Provider<AiConsultationRepository>(
  (ref) => AiConsultationRepositoryImpl(
    ref.watch(aiConsultationRemoteDataSourceProvider),
  ),
);

final aiConsultationNotifierProvider =
    StateNotifierProvider.autoDispose<
      AiConsultationNotifier,
      AiConsultationState
    >((ref) {
      return AiConsultationNotifier(
        ref.watch(aiConsultationRepositoryProvider),
      );
    });

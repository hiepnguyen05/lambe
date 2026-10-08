import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../auth/di/auth_providers.dart';
import '../application/onboarding_notifier.dart';
import '../data/datasources/dio_onboarding_remote_datasource.dart';
import '../data/repositories/onboarding_repository_impl.dart';
import '../domain/repositories/onboarding_repository.dart';

export '../application/onboarding_notifier.dart';

final onboardingRepositoryProvider = Provider<OnboardingRepository>((ref) {
  return OnboardingRepositoryImpl(
    DioOnboardingRemoteDataSource(ref.watch(dioProvider)),
  );
});

final onboardingNotifierProvider =
    StateNotifierProvider<OnboardingNotifier, OnboardingState>((ref) {
      return OnboardingNotifier(
        ref.watch(onboardingRepositoryProvider),
        ref.read(authNotifierProvider.notifier).updateOnboardingStatus,
      );
    });

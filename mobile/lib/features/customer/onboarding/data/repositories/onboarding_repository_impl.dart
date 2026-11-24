import '../../domain/entities/onboarding_options_entity.dart';
import '../../domain/entities/onboarding_preferences.dart';
import '../../domain/repositories/onboarding_repository.dart';
import '../datasources/onboarding_remote_datasource.dart';

class OnboardingRepositoryImpl implements OnboardingRepository {
  final OnboardingRemoteDataSource remoteDataSource;

  OnboardingRepositoryImpl(this.remoteDataSource);

  @override
  Future<OnboardingOptionsEntity> getOptions() async {
    final data = await remoteDataSource.getOptions();
    return OnboardingOptionsEntity.fromJson(data);
  }

  @override
  Future<OnboardingPreferences> getCurrentPreferences() async {
    final data = await remoteDataSource.getCurrentPreferences();
    return OnboardingPreferences.fromJson(data);
  }

  @override
  Future<void> saveOnboardingData(OnboardingPreferences preferences) async {
    await remoteDataSource.saveOnboardingData(preferences.toJson());
  }

  @override
  Future<void> completeOnboarding() async {
    await remoteDataSource.completeOnboarding();
  }

  @override
  Future<void> skipOnboarding() async {
    await remoteDataSource.skipOnboarding();
  }
}

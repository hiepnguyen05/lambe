import '../../domain/entities/onboarding_options_entity.dart';
import '../../domain/entities/onboarding_preferences.dart';
import '../../domain/repositories/onboarding_repository.dart';
import '../datasources/onboarding_remote_datasource.dart';
import '../models/onboarding_model.dart';

class OnboardingRepositoryImpl implements OnboardingRepository {
  final OnboardingRemoteDataSource remoteDataSource;

  OnboardingRepositoryImpl(this.remoteDataSource);

  @override
  Future<OnboardingOptionsEntity> getOptions() async {
    final data = await remoteDataSource.getOptions();
    return OnboardingModel.optionsFromJson(data);
  }

  @override
  Future<OnboardingPreferences> getCurrentPreferences() async {
    final data = await remoteDataSource.getCurrentPreferences();
    return OnboardingModel.preferencesFromJson(data);
  }

  @override
  Future<void> saveOnboardingData(OnboardingPreferences preferences) async {
    await remoteDataSource.saveOnboardingData(
      OnboardingModel.preferencesToJson(preferences),
    );
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

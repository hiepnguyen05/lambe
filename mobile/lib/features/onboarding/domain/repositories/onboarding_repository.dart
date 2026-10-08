import '../../domain/entities/onboarding_options_entity.dart';
import '../../domain/entities/onboarding_preferences.dart';

abstract class OnboardingRepository {
  Future<OnboardingOptionsEntity> getOptions();
  Future<OnboardingPreferences> getCurrentPreferences();
  Future<void> saveOnboardingData(OnboardingPreferences preferences);
  Future<void> completeOnboarding();
  Future<void> skipOnboarding();
}

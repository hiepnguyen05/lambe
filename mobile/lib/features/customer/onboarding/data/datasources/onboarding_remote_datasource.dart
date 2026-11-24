abstract interface class OnboardingRemoteDataSource {
  Future<Map<String, dynamic>> getOptions();
  Future<Map<String, dynamic>> getCurrentPreferences();
  Future<void> saveOnboardingData(Map<String, dynamic> data);
  Future<void> completeOnboarding();
  Future<void> skipOnboarding();
}

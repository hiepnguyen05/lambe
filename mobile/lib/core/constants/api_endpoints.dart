class ApiEndpoints {
  ApiEndpoints._();

  // Android Emulator maps 10.0.2.2 to the host machine where Docker exposes the API.
  // Use http://localhost:5000/api only when running through USB adb reverse.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5000/api',
  );

  static const Duration connectionTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);

  // Auth Endpoints (Firebase-based)
  static const String exchangeFirebaseToken = '/auth/firebase';
  static const String checkPhoneLink = '/auth/firebase/phone-link-check';
  static const String completeRegistration = '/auth/complete-registration';
  static const String me = '/auth/me';
  static const String meAvatar = '/auth/me/avatar';

  // Customer Onboarding
  static const String onboardingOptions = '/onboarding/options';
  static const String onboarding = '/me/onboarding';
  static const String onboardingComplete = '/me/onboarding/complete';
  static const String onboardingSkip = '/me/onboarding/skip';
  static const String serviceRecommendations = '/me/recommendations/services';

  // Categories & Services
  static const String categories = '/categories';
  static const String services = '/services';

  // Customer Addresses
  static const String meAddresses = '/me/addresses';
  static String meAddress(String id) => '$meAddresses/$id';
  static String defaultAddress(String id) => '${meAddress(id)}/default';

  // Provider Applications
  static const String providerApplications = '/provider-applications';
  static String providerApplication(String id) => '$providerApplications/$id';
  static String providerApplicationServices(String id) =>
      '${providerApplication(id)}/services';
  static String providerServiceSuggestions(String id) =>
      '${providerApplication(id)}/service-suggestions';
  static String providerDocument(String id, String type) =>
      '${providerApplication(id)}/documents/$type';
  static String providerTerms(String id) =>
      '${providerApplication(id)}/terms/accept';
  static String providerSubmit(String id) =>
      '${providerApplication(id)}/submit';
}

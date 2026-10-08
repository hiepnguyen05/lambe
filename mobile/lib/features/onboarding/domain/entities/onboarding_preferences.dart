class OnboardingPreferences {
  final String? gender;
  final String? preferredAudience;
  final List<String> categoryIds;
  final String? pricePreference;

  const OnboardingPreferences({
    this.gender,
    this.preferredAudience,
    this.categoryIds = const [],
    this.pricePreference,
  });

  bool get isEmpty =>
      gender == null &&
      preferredAudience == null &&
      categoryIds.isEmpty &&
      pricePreference == null;
}

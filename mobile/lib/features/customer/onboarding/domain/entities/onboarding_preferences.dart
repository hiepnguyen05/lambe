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

  factory OnboardingPreferences.fromJson(Map<String, dynamic> json) {
    return OnboardingPreferences(
      gender: json['gender']?.toString(),
      preferredAudience: json['preferredAudience']?.toString(),
      categoryIds: _idsFrom(json['categoryIds'] ?? json['categories']),
      pricePreference: json['pricePreference']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (gender != null) 'gender': gender,
      if (preferredAudience != null) 'preferredAudience': preferredAudience,
      'categoryIds': categoryIds,
      'serviceIds': <String>[],
      if (pricePreference != null) 'pricePreference': pricePreference,
    };
  }

  static List<String> _idsFrom(dynamic value) {
    if (value is! List) return const [];

    return value
        .map((item) {
          if (item is Map) return item['id']?.toString();
          return item?.toString();
        })
        .whereType<String>()
        .where((id) => id.isNotEmpty)
        .toList(growable: false);
  }
}

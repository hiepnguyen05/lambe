import '../../domain/entities/onboarding_options_entity.dart';
import '../../domain/entities/onboarding_preferences.dart';

class OnboardingModel {
  const OnboardingModel._();

  static OnboardingOptionsEntity optionsFromJson(Map<String, dynamic> json) {
    final categories = <OnboardingCategory>[];
    final rawCategories = json['categories'];

    if (rawCategories is List) {
      for (final rawCategory in rawCategories) {
        if (rawCategory is! Map) continue;
        final categoryJson = Map<String, dynamic>.from(rawCategory);
        final category = _categoryFromJson(categoryJson);
        categories.add(category);
      }
    }

    return OnboardingOptionsEntity(categories: categories);
  }

  static Map<String, dynamic> preferencesToJson(
    OnboardingPreferences preferences,
  ) {
    return {
      if (preferences.gender != null) 'gender': preferences.gender,
      if (preferences.preferredAudience != null)
        'preferredAudience': preferences.preferredAudience,
      'categoryIds': preferences.categoryIds,
      'serviceIds': <String>[],
      if (preferences.pricePreference != null)
        'pricePreference': preferences.pricePreference,
    };
  }

  static OnboardingPreferences preferencesFromJson(Map<String, dynamic> json) {
    return OnboardingPreferences(
      gender: json['gender']?.toString(),
      preferredAudience: json['preferredAudience']?.toString(),
      categoryIds: _idsFrom(json['categoryIds'] ?? json['categories']),
      pricePreference: json['pricePreference']?.toString(),
    );
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

  static OnboardingCategory _categoryFromJson(Map<String, dynamic> json) {
    return OnboardingCategory(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Không rõ',
      iconUrl: json['iconUrl']?.toString(),
    );
  }
}

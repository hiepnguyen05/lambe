class OnboardingOptionsEntity {
  final List<OnboardingCategory> categories;

  const OnboardingOptionsEntity({required this.categories});

  factory OnboardingOptionsEntity.fromJson(Map<String, dynamic> json) {
    final categories = <OnboardingCategory>[];
    final rawCategories = json['categories'];

    if (rawCategories is List) {
      for (final rawCategory in rawCategories) {
        if (rawCategory is! Map) continue;
        categories.add(
          OnboardingCategory.fromJson(Map<String, dynamic>.from(rawCategory)),
        );
      }
    }

    return OnboardingOptionsEntity(categories: categories);
  }
}

class OnboardingCategory {
  final String id;
  final String name;
  final String? iconUrl;

  const OnboardingCategory({
    required this.id,
    required this.name,
    this.iconUrl,
  });

  factory OnboardingCategory.fromJson(Map<String, dynamic> json) {
    return OnboardingCategory(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Không rõ',
      iconUrl: json['iconUrl']?.toString(),
    );
  }
}

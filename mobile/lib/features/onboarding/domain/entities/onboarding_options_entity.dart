class OnboardingOptionsEntity {
  final List<OnboardingCategory> categories;

  OnboardingOptionsEntity({required this.categories});
}

class OnboardingCategory {
  final String id;
  final String name;
  final String? iconUrl;

  OnboardingCategory({required this.id, required this.name, this.iconUrl});
}

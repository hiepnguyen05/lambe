import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/onboarding/application/onboarding_notifier.dart';
import 'package:mobile/features/onboarding/domain/entities/onboarding_options_entity.dart';
import 'package:mobile/features/onboarding/domain/entities/onboarding_preferences.dart';
import 'package:mobile/features/onboarding/domain/repositories/onboarding_repository.dart';

void main() {
  test('limits onboarding interests to three categories', () async {
    final notifier = OnboardingNotifier(_FakeOnboardingRepository(), (_) {});
    await pumpEventQueue();

    expect(notifier.toggleCategory('hair'), isTrue);
    expect(notifier.toggleCategory('nail'), isTrue);
    expect(notifier.toggleCategory('spa'), isTrue);
    expect(notifier.toggleCategory('makeup'), isFalse);
    expect(notifier.state.categoryIds, ['hair', 'nail', 'spa']);

    notifier.dispose();
  });
}

class _FakeOnboardingRepository implements OnboardingRepository {
  @override
  Future<void> completeOnboarding() async {}

  @override
  Future<OnboardingPreferences> getCurrentPreferences() async {
    return const OnboardingPreferences();
  }

  @override
  Future<OnboardingOptionsEntity> getOptions() async {
    return OnboardingOptionsEntity(categories: const []);
  }

  @override
  Future<void> saveOnboardingData(OnboardingPreferences preferences) async {}

  @override
  Future<void> skipOnboarding() async {}
}

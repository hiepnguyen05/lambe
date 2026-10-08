import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/domain/entities/user_entity.dart';

void main() {
  test('copyWith updates onboarding status without losing user data', () {
    const user = UserEntity(
      id: 'user-1',
      phone: '0900000000',
      fullName: 'Lambe User',
      onboardingStatus: 'PENDING',
    );

    final updated = user.copyWith(onboardingStatus: 'COMPLETED');

    expect(updated.id, user.id);
    expect(updated.phone, user.phone);
    expect(updated.fullName, user.fullName);
    expect(updated.onboardingStatus, 'COMPLETED');
  });
}

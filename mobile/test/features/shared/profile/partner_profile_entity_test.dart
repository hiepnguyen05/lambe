import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_profile_entity.dart';
import 'package:mobile/features/shared/profile/presentation/widgets/sections/partner_quick_stats_grid.dart';

void main() {
  test('does not fabricate provider metrics when the API has none', () {
    const profile = PartnerProfileEntity(
      id: 'provider-id',
      displayName: 'Provider',
    );

    expect(profile.completedBookings, isNull);
    expect(profile.acceptanceRate, isNull);
    expect(profile.onTimeRate, isNull);
    expect(profile.rating, isNull);
    expect(profile.reviewCount, isNull);
    expect(profile.portfolioPhotosCount, isNull);
    expect(profile.certificatesCount, isNull);
    expect(profile.isVerified, isFalse);
    expect(profile.isDispatchEnabled, isFalse);
  });

  testWidgets('shows unavailable markers when provider metrics are missing', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PartnerQuickStatsGrid(
            completedBookings: null,
            acceptanceRate: null,
            onTimeRate: null,
          ),
        ),
      ),
    );

    expect(find.text('--'), findsNWidgets(3));
  });
}

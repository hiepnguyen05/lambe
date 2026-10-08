import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/partner/presentation/widgets/partner_registration_progress.dart';

void main() {
  testWidgets('shows the current registration step on a narrow screen', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PartnerRegistrationProgress(
            currentStep: PartnerRegistrationStep.identity,
          ),
        ),
      ),
    );

    expect(find.bySemanticsLabel('Bước 4 trên 6: Danh tính'), findsOneWidget);
    expect(find.byType(AnimatedContainer), findsNWidgets(6));
    expect(tester.takeException(), isNull);
  });

  testWidgets('maps the final screen to step six', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PartnerRegistrationProgress(
            currentStep: PartnerRegistrationStep.submit,
          ),
        ),
      ),
    );

    expect(find.bySemanticsLabel('Bước 6 trên 6: Hoàn tất'), findsOneWidget);
  });
}

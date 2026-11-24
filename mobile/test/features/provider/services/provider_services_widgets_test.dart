import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/services/application/service_change_controller.dart';
import 'package:mobile/features/provider/services/data/provider_service_mapper.dart';
import 'package:mobile/features/provider/services/di/provider_services_providers.dart';
import 'package:mobile/features/provider/services/domain/service_change.dart';
import 'package:mobile/features/provider/services/domain/service_change_draft.dart';
import 'package:mobile/features/provider/services/presentation/screens/service_change_detail_screen.dart';
import 'package:mobile/features/provider/services/presentation/widgets/service_change_form.dart';
import 'package:mobile/features/provider/services/presentation/widgets/service_choice_field.dart';

import 'support/service_fakes.dart';

Finder input(String label) => find.byWidgetPredicate(
  (v) => v is TextField && v.decoration?.labelText == label,
);
void main() {
  for (final status in ServiceChangeStatus.values) {
    testWidgets('${status.wire} exposes only actions supported by backend', (
      tester,
    ) async {
      final repo = FakeProviderServicesRepository()
        ..current = changeFromJson(changeJson(status: status));
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceChangeProvider.overrideWith(
              (ref, id) => ServiceChangeController(
                repo,
                FakeServiceMediaRepository(),
                id,
                changed: () {},
              )..load(),
            ),
          ],
          child: const MaterialApp(
            home: ServiceChangeDetailScreen(id: 'request'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Trạng thái: ${status.label}'), findsOneWidget);
      expect(
        find.text('Sửa thông tin bản nháp'),
        repo.current.editable ? findsOneWidget : findsNothing,
      );
      expect(
        find.text('Tải chứng chỉ nghề'),
        repo.current.editable ? findsOneWidget : findsNothing,
      );
      if (repo.current.canWithdraw) {
        await tester.scrollUntilVisible(
          find.text('Rút đề xuất'),
          180,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.pumpAndSettle();
        expect(find.text('Rút đề xuất'), findsOneWidget);
      } else {
        expect(find.text('Rút đề xuất'), findsNothing);
      }
      if (status == ServiceChangeStatus.needsChanges) {
        expect(find.textContaining('Ảnh chứng chỉ bị mờ.'), findsOneWidget);
      }
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets(
    'editing offering validates price and submits an exact draft without changing the offering directly',
    (tester) async {
      ServiceChangeDraft? sent;
      final repo = FakeProviderServicesRepository();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView(
              children: [
                ServiceChangeForm(
                  options: ServiceEditorOptions(
                    [repo.definition],
                    [repo.definition.category],
                    [repo.currentOffering],
                  ),
                  offeringId: 'offering',
                  disabled: false,
                  onSave: (draft, _) async {
                    sent = draft;
                  },
                ),
              ],
            ),
          ),
        ),
      );
      await tester.enterText(input('Giá đề xuất (đồng)'), '49999');
      await tester.ensureVisible(find.byType(FilledButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lưu bản nháp'));
      await tester.pumpAndSettle();
      expect(sent, isNull);
      expect(find.textContaining('Giá phải trong khoảng'), findsOneWidget);
      await tester.enterText(input('Giá đề xuất (đồng)'), '150000');
      await tester.ensureVisible(find.byType(FilledButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lưu bản nháp'));
      await tester.pumpAndSettle();
      expect(sent?.type, ServiceChangeType.updateOffering);
      expect(sent?.offeringId, 'offering');
      expect(sent?.price, 150000);
      expect(repo.currentOffering.price, 100000);
    },
  );
  testWidgets(
    'new-service form scrolls on 320px screen with large text and keyboard',
    (tester) async {
      tester.view.physicalSize = const Size(320, 620);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 160);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      final repo = FakeProviderServicesRepository();
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: TextScaler.linear(1.4)),
            child: child!,
          ),
          home: Scaffold(
            body: ListView(
              children: [
                ServiceChangeForm(
                  options: ServiceEditorOptions(
                    [repo.definition],
                    [repo.definition.category],
                    [],
                  ),
                  existing: changeFromJson(
                    changeJson(type: ServiceChangeType.proposeNew),
                  ),
                  disabled: false,
                  onSave: (_, _) async {},
                ),
              ],
            ),
          ),
        ),
      );
      await tester.ensureVisible(find.byType(FilledButton));
      await tester.pumpAndSettle();
      expect(find.text('Lưu bản nháp').hitTestable(), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'catalog chooser lazily renders search matches and returns the selected ID',
    (tester) async {
      String? selected;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ServiceChoiceField(
              label: 'Chọn dịch vụ',
              options: List.generate(150, (i) => ('service-$i', 'Dịch vụ $i')),
              onChanged: (value) => selected = value,
            ),
          ),
        ),
      );
      await tester.tap(find.text('Chọn dịch vụ'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Dịch vụ 149');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(ListTile, 'Dịch vụ 149'));
      await tester.pumpAndSettle();
      expect(selected, 'service-149');
    },
  );
}

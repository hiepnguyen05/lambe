import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

void main() {
  testWidgets('confirm dialog returns the selected result', (tester) async {
    bool? result;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () async {
              result = await AppDialog.showConfirmDialog(
                context,
                title: 'Xác nhận',
                message: 'Tiếp tục?',
              );
            },
            child: const Text('Mở'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Mở'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();

    expect(result, isFalse);
  });

  testWidgets('message dialog closes and invokes its callback', (tester) async {
    var callbackInvoked = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () => AppDialog.showMessageDialog(
              context,
              title: 'Thành công',
              message: 'Đã lưu dữ liệu.',
              onPressed: () => callbackInvoked = true,
            ),
            child: const Text('Mở'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Mở'));
    await tester.pumpAndSettle();
    expect(find.text('Đã lưu dữ liệu.'), findsOneWidget);

    await tester.tap(find.text('Đóng'));
    await tester.pumpAndSettle();

    expect(callbackInvoked, isTrue);
    expect(find.byType(AlertDialog), findsNothing);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

void main() {
  testWidgets(
    'AppDialog.confirm displays title, message, cancel and confirm buttons',
    (tester) async {
      bool? dialogResult;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () async {
                  dialogResult = await AppDialog.confirm(
                    context,
                    title: 'Xác nhận xóa?',
                    message: 'Bạn có chắc chắn muốn xóa mục này không?',
                    confirmText: 'Xóa ngay',
                    cancelText: 'Hủy bỏ',
                    isDestructive: true,
                  );
                },
                child: const Text('Mở dialog confirm'),
              ),
            ),
          ),
        ),
      );

      // Mở dialog
      await tester.tap(find.text('Mở dialog confirm'));
      await tester.pumpAndSettle();

      expect(find.text('Xác nhận xóa?'), findsOneWidget);
      expect(
        find.text('Bạn có chắc chắn muốn xóa mục này không?'),
        findsOneWidget,
      );
      expect(find.text('Hủy bỏ'), findsOneWidget);
      expect(find.text('Xóa ngay'), findsOneWidget);

      // Bấm nút Hủy bỏ -> Trả về false
      await tester.tap(find.text('Hủy bỏ'));
      await tester.pumpAndSettle();

      expect(find.text('Xác nhận xóa?'), findsNothing);
      expect(dialogResult, isFalse);

      // Mở lại và bấm nút Xóa ngay -> Trả về true
      await tester.tap(find.text('Mở dialog confirm'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Xóa ngay'));
      await tester.pumpAndSettle();

      expect(dialogResult, isTrue);
    },
  );

  testWidgets(
    'AppDialog.success displays success styling and closes on button tap',
    (tester) async {
      bool buttonCallbackFired = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Builder(
              builder: (context) => ElevatedButton(
                onPressed: () {
                  AppDialog.success(
                    context,
                    title: 'Đặt lịch thành công',
                    message: 'Chuyên viên sẽ liên hệ với bạn sớm nhất.',
                    buttonText: 'Hoàn tất',
                    onPressed: () {
                      buttonCallbackFired = true;
                    },
                  );
                },
                child: const Text('Mở success'),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Mở success'));
      await tester.pumpAndSettle();

      expect(find.text('Đặt lịch thành công'), findsOneWidget);
      expect(
        find.text('Chuyên viên sẽ liên hệ với bạn sớm nhất.'),
        findsOneWidget,
      );
      expect(find.text('Hoàn tất'), findsOneWidget);

      await tester.tap(find.text('Hoàn tất'));
      await tester.pumpAndSettle();

      expect(find.text('Đặt lịch thành công'), findsNothing);
      expect(buttonCallbackFired, isTrue);
    },
  );

  testWidgets('AppDialog.error displays error styling and message', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => ElevatedButton(
              onPressed: () {
                AppDialog.error(
                  context,
                  title: 'Lỗi kết nối',
                  message: 'Không thể kết nối đến máy chủ. Vui lòng thử lại.',
                  buttonText: 'Đóng lại',
                );
              },
              child: const Text('Mở error'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Mở error'));
    await tester.pumpAndSettle();

    expect(find.text('Lỗi kết nối'), findsOneWidget);
    expect(
      find.text('Không thể kết nối đến máy chủ. Vui lòng thử lại.'),
      findsOneWidget,
    );
    expect(find.text('Đóng lại'), findsOneWidget);

    await tester.tap(find.text('Đóng lại'));
    await tester.pumpAndSettle();

    expect(find.text('Lỗi kết nối'), findsNothing);
  });
}

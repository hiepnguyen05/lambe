import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/service_detail_provider.dart';
import 'package:mobile/features/customer/catalog/presentation/screens/service_detail_screen.dart';

void main() {
  const testService = ServiceItemEntity(
    id: 'srv_nail_korean',
    code: 'NAIL_KOREAN',
    slug: 'son-gel-han-quoc-cat-da',
    name: 'Sơn Gel Hàn Quốc & Cắt Da',
    description: 'Chăm sóc cắt da sạch sẽ, định hình móng chuẩn phom và sơn gel bền đẹp công nghệ Hàn Quốc giữ màu 3–4 tuần ngay tại không gian thoải mái của bạn.',
    coverImageUrl: 'https://example.com/nail.jpg',
    defaultDurationMinutes: 45,
    minPriceAmount: 120000,
    maxPriceAmount: 200000,
    requiresCertificate: true,
    category: ServiceCategorySummaryEntity(
      id: 'cat_nail',
      code: 'nail',
      name: 'Nail',
      slug: 'nail',
    ),
  );

  testWidgets(
    'ServiceDetailScreen renders catalog detail and directs provider search through booking',
    (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceDetailBySlugProvider('son-gel-han-quoc-cat-da')
                .overrideWith((ref) async => testService),
          ],
          child: const MaterialApp(
            home: ServiceDetailScreen(
              serviceSlug: 'son-gel-han-quoc-cat-da',
              initialService: testService,
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // Verify Title & Hero duration
      expect(find.text('Chi Tiết Dịch Vụ'), findsOneWidget);
      expect(find.text('Sơn Gel Hàn Quốc & Cắt Da'), findsOneWidget);
      expect(find.text('45 phút'), findsOneWidget);
      expect(find.text('Phổ biến nhất'), findsOneWidget);

      // Verify Meta and Price in Overview Card
      expect(find.text('Tiệt trùng chuẩn Y tế'), findsNothing);
      expect(find.text('Đến tận nhà trong 30p'), findsNothing);
      expect(find.textContaining('120.000₫'), findsOneWidget);

      // Verify 4-step procedure
      expect(find.text('Quy trình thực hiện chuẩn'), findsOneWidget);
      expect(find.text('4 bước an tâm'), findsOneWidget);

      // Verify real specialists section
      expect(find.text('Chuyên gia gần bạn'), findsNothing);
      expect(find.text('Lê Hoàng Yến'), findsNothing);
      expect(find.textContaining('Chọn địa chỉ và thời gian'), findsOneWidget);

      // Verify bottom booking bar
      expect(find.text('Đặt lịch ngay'), findsOneWidget);
    },
  );

  testWidgets(
    'ServiceDetailScreen hides specialists section when no nearby technicians exist',
    (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            serviceDetailBySlugProvider('son-gel-han-quoc-cat-da')
                .overrideWith((ref) async => testService),
          ],
          child: const MaterialApp(
            home: ServiceDetailScreen(
              serviceSlug: 'son-gel-han-quoc-cat-da',
              initialService: testService,
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      // When technicians list is empty, no mock specialists are shown
      expect(find.text('Chuyên gia gần bạn'), findsNothing);
      expect(find.text('Hoàng Vũ Beauty'), findsNothing);
      expect(find.text('Lê Hoàng Yến'), findsNothing);
    },
  );
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';
import 'package:mobile/features/shared/profile/presentation/screens/partner_public_profile_screen.dart';

void main() {
  testWidgets(
    'PartnerPublicProfileScreen renders real provider profile data matching HTML model',
    (tester) async {
      final testProfile = PartnerPublicProfileEntity(
        id: 'prov-001',
        displayName: 'Lê Hoàng Yến',
        biography:
            'Hơn 5 năm kinh nghiệm phục vụ tại các spa cao cấp tại Thảo Điền.',
        experienceYears: 5,
        serviceAreaName: 'Thảo Điền, TP. Thủ Đức',
        serviceRadiusKm: 5,
        isOnline: true,
        completedOrdersCount: 356,
        rating: 4.95,
        reviewCount: 142,
        acceptanceRate: 98.5,
        onTimeRate: 99.0,
        services: const [
          PublicServiceItemEntity(
            id: 'ps-1',
            serviceId: 's-1',
            name: 'Sơn Gel Hàn Quốc cao cấp & Cắt da',
            slug: 'son-gel-han-quoc',
            iconUrl: 'brush',
            categoryName: 'Làm móng',
            categorySlug: 'nail',
            priceAmount: 180000,
            durationMinutes: 40,
            description: 'Sơn gel chuẩn Hàn bền bóng 4 tuần.',
          ),
        ],
        reviews: [
          PublicReviewItemEntity(
            id: 'r-1',
            rating: 5,
            comment: 'Chị Yến đến rất đúng giờ, kỹ thuật sơn móng cực kỳ khéo.',
            createdAt: DateTime(2026, 10, 22),
            customerName: 'Trần Mai Anh',
          ),
        ],
        portfolio: const [
          PublicPortfolioItemEntity(
            id: 'port-1',
            title: 'Ombre Đào',
            imageUrl: '',
            likesCount: 48,
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            publicPartnerProfileProvider('prov-001')
                .overrideWith((ref) async => testProfile),
          ],
          child: const MaterialApp(
            home: PartnerPublicProfileScreen(providerId: 'prov-001'),
          ),
        ),
      );

      // Initial loading
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      // Pump to settle async data
      await tester.pumpAndSettle();

      // Verify header and names
      expect(find.text('Hồ Sơ Chuyên Gia'), findsOneWidget);
      final appBar = tester.widget<AppBar>(find.byType(AppBar));
      expect(appBar.centerTitle, isTrue);
      expect(appBar.actions, hasLength(1));
      expect(find.byTooltip('Beauty Feed của chuyên viên'), findsOneWidget);

      expect(find.text('Lê Hoàng Yến'), findsOneWidget);
      expect(find.text('#LB-PROV'), findsNothing);
      expect(find.text('+ Theo dõi'), findsOneWidget);

      // Verify stats
      expect(find.text('356+'), findsOneWidget);
      expect(
        find.text('5.0'),
        findsWidgets,
      ); // 4.95 rounded to 1 decimal place is 5.0

      // Verify exactly 3 tabs matching HTML: "Giới thiệu", "Nhật ký", "Đánh giá"
      expect(find.text('Giới thiệu'), findsOneWidget);
      expect(find.text('Nhật ký'), findsOneWidget);
      expect(find.text('Đánh giá'), findsOneWidget);

      // Verify Tab 0 ("Giới thiệu") contains Services, Spotlight Portfolio & Reviews, and Guarantee card is removed
      expect(find.text('Về chuyên viên Lê Hoàng Yến'), findsOneWidget);
      expect(find.text('Sơn Gel Hàn Quốc cao cấp & Cắt da'), findsOneWidget);
      expect(find.text('180.000đ'), findsOneWidget);
      expect(find.text('Đặt lịch'), findsOneWidget);
      expect(find.text('Tác phẩm thực tế của thợ'), findsOneWidget);
      expect(find.text('Đánh giá thực tế nổi bật'), findsOneWidget);
      expect(find.text('Cam kết an tâm từ Lambe'), findsNothing);

      // Verify bottom bar with "Giá dịch vụ từ" is REMOVED
      expect(find.text('Giá dịch vụ từ'), findsNothing);
      expect(find.text('Đặt ngay'), findsNothing);

      // Switch to Tab 1: "Nhật ký"
      await tester.tap(find.text('Nhật ký'));
      await tester.pumpAndSettle();

      expect(find.text('Nhật ký làm đẹp (1 tác phẩm)'), findsOneWidget);
      expect(find.text('48'), findsOneWidget); // likes count

      // Switch to Tab 2: "Đánh giá"
      await tester.tap(find.text('Đánh giá'));
      await tester.pumpAndSettle();

      expect(find.text('Trần Mai Anh'), findsOneWidget);
      expect(find.textContaining('Chị Yến đến rất đúng giờ'), findsOneWidget);
    },
  );
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_profile_entity.dart';
import 'package:mobile/features/shared/profile/presentation/widgets/sections/partner_customer_utilities_section.dart';
import 'package:mobile/features/shared/profile/presentation/widgets/sections/partner_mode_switch_card.dart';
import 'package:mobile/features/shared/profile/presentation/widgets/sections/partner_profile_header_card.dart';

void main() {
  group('PartnerModeSwitchCard', () {
    testWidgets('renders register partner banner for pure customers', (
      tester,
    ) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PartnerModeSwitchCard(
              isProvider: false,
              isProviderMode: false,
              onSwitchTap: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Đăng ký trở thành đối tác'), findsOneWidget);
      expect(
        find.text('Gia nhập mạng lưới chuyên viên làm đẹp Lambe'),
        findsOneWidget,
      );
      expect(find.text('Đăng ký'), findsOneWidget);

      await tester.tap(find.text('Đăng ký'));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets(
      'renders switch to provider mode when provider is in customer mode',
      (tester) async {
        var tapped = false;
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: PartnerModeSwitchCard(
                isProvider: true,
                isProviderMode: false,
                onSwitchTap: () => tapped = true,
              ),
            ),
          ),
        );

        expect(find.text('Chế độ Đối tác'), findsOneWidget);
        expect(
          find.text('Không gian làm việc & nhận đơn dành cho chuyên gia'),
          findsOneWidget,
        );
        expect(find.text('Chuyển'), findsOneWidget);

        await tester.tap(find.text('Chuyển'));
        await tester.pump();
        expect(tapped, isTrue);
      },
    );

    testWidgets(
      'renders switch to customer mode when provider is in provider mode',
      (tester) async {
        var tapped = false;
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: PartnerModeSwitchCard(
                isProvider: true,
                isProviderMode: true,
                onSwitchTap: () => tapped = true,
              ),
            ),
          ),
        );

        expect(find.text('Chế độ Khách hàng'), findsOneWidget);
        expect(
          find.text('Chuyển sang đặt lịch móng, tóc & spa tận nơi'),
          findsOneWidget,
        );
        expect(find.text('Chuyển'), findsOneWidget);

        await tester.tap(find.text('Chuyển'));
        await tester.pump();
        expect(tapped, isTrue);
      },
    );
  });

  group('PartnerCustomerUtilitiesSection', () {
    testWidgets('renders all customer navigation and settings tiles', (
      tester,
    ) async {
      var editTapped = false;
      var prefTapped = false;
      var addrTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: PartnerCustomerUtilitiesSection(
                onEditProfileTap: () => editTapped = true,
                onPreferencesTap: () => prefTapped = true,
                onAddressTap: () => addrTapped = true,
              ),
            ),
          ),
        ),
      );

      expect(find.text('TIỆN ÍCH DỊCH VỤ & LÀM ĐẸP'), findsOneWidget);
      expect(find.text('Thông tin cá nhân'), findsOneWidget);
      expect(find.text('Sở thích làm đẹp'), findsOneWidget);
      expect(find.text('Sổ địa chỉ'), findsOneWidget);
      expect(find.text('Lời mời gia nhập cơ sở'), findsNothing);

      expect(find.text('CÀI ĐẶT & HỖ TRỢ'), findsOneWidget);
      expect(find.text('Cài đặt thông báo'), findsOneWidget);
      expect(find.text('Trung tâm trợ giúp Lambe'), findsOneWidget);
      expect(find.text('Điều khoản & Chính sách'), findsOneWidget);

      await tester.tap(find.text('Thông tin cá nhân'));
      await tester.tap(find.text('Sở thích làm đẹp'));
      await tester.tap(find.text('Sổ địa chỉ'));
      await tester.pump();

      expect(editTapped, isTrue);
      expect(prefTapped, isTrue);
      expect(addrTapped, isTrue);
    });
  });

  group('PartnerProfileHeaderCard unified tests', () {
    testWidgets('adapts cleanly for pure customer with no public profile link', (
      tester,
    ) async {
      const customerProfile = PartnerProfileEntity(
        id: 'cust-123',
        displayName: 'Nguyễn Văn A',
      );

      var avatarTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PartnerProfileHeaderCard(
              profile: customerProfile,
              isProvider: false,
              customerPhone: '0987654321',
              onAvatarTap: () => avatarTapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Nguyễn Văn A'), findsOneWidget);
      expect(find.text('0987654321'), findsOneWidget);
      expect(find.text('Tài khoản đã xác thực'), findsOneWidget);
      expect(find.text('Xem hồ sơ công khai'), findsNothing);

      // Tap avatar triggers callback
      await tester.tap(find.byType(GestureDetector).first);
      await tester.pump();
      expect(avatarTapped, isTrue);
    });

    testWidgets('shows public profile action for provider', (tester) async {
      const providerProfile = PartnerProfileEntity(
        id: 'prov-456',
        displayName: 'Chuyên gia Lan',
        isVerified: true,
        rating: 4.9,
        completedBookings: 85,
      );

      var viewPublicTapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: PartnerProfileHeaderCard(
              profile: providerProfile,
              isProvider: true,
              onViewPublicProfileTap: () => viewPublicTapped = true,
            ),
          ),
        ),
      );

      expect(find.text('Chuyên gia Lan'), findsOneWidget);
      expect(find.text('Chuyên viên dịch vụ Lambe'), findsOneWidget);
      expect(find.text('Đã xác minh'), findsOneWidget);
      expect(find.text('Xem hồ sơ công khai (Khách xem)'), findsOneWidget);

      await tester.tap(find.text('Xem hồ sơ công khai (Khách xem)'));
      await tester.pump();
      expect(viewPublicTapped, isTrue);
    });
  });
}

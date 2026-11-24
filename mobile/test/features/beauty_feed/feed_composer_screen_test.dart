import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/features/provider/services/domain/provider_offering.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_publishing_repository.dart';
import 'package:mobile/features/shared/beauty_feed/di/feed_providers.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/screens/feed_composer_screen.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_composer_identity_bar.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_composer_media_grid.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_composer_service_sheet.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_composer_consent_card.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_composer_bottom_toolbar.dart';

class _FakeAuthRepo implements AuthRepository {
  @override
  Future<UserEntity?> getCurrentUser() async => const UserEntity(
        id: 'provider-user-1',
        fullName: 'Salon Tóc Đẹp',
        roles: ['PROVIDER'],
      );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  final testOffering = ProviderOffering(
    id: 'offering-1',
    serviceId: 'service-1',
    status: 'ACTIVE',
    price: 180000,
    duration: 45,
    service: const ServiceDefinition(
      id: 'service-1',
      name: 'Uốn tóc phục hồi',
      category: ServiceCategoryOption(id: 'cat-1', name: 'Tóc'),
      minPrice: 100000,
      maxPrice: 800000,
    ),
  );

  final testContext = FeedPublishingContext(
    providerId: 'provider-1',
    memberId: null,
    offerings: [testOffering],
  );

  testWidgets(
      'FeedComposerScreen renders modern layout with all sections and controls',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() => tester.view.resetPhysicalSize());

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_FakeAuthRepo()),
          feedPublishingContextProvider
              .overrideWith((ref) => Future.value(testContext)),
        ],
        child: const MaterialApp(
          home: FeedComposerScreen(),
        ),
      ),
    );

    // Initial pump & settle to resolve futures
    await tester.pumpAndSettle();

    // Verify AppBar Title and Buttons
    expect(find.text('Tạo tác phẩm'), findsOneWidget);
    expect(find.byIcon(Icons.close_rounded), findsOneWidget);
    expect(find.text('Đăng'), findsOneWidget);

    // Verify Partner Identity Bar
    expect(find.byType(FeedComposerIdentityBar), findsOneWidget);
    expect(find.text('Salon Tóc Đẹp'), findsOneWidget);
    expect(find.text('Công khai toàn hệ thống'), findsOneWidget);

    // Verify Caption Input
    expect(
      find.byWidgetPredicate((widget) =>
          widget is TextField &&
          widget.decoration?.hintText
                  ?.contains('Chia sẻ câu chuyện hoặc kỹ thuật') ==
              true),
      findsOneWidget,
    );

    // Verify Media Grid Picker
    expect(find.byType(FeedComposerMediaGrid), findsOneWidget);
    expect(find.text('Chọn ảnh'), findsOneWidget);
    expect(find.text('Chọn Video'), findsOneWidget);

    // Verify Customer Consent Card
    expect(find.byType(FeedComposerConsentCard), findsOneWidget);
    expect(find.text('Có xuất hiện khách hàng'), findsOneWidget);

    // Verify Service Selection Section
    expect(find.byType(FeedComposerServiceSection), findsOneWidget);
    expect(find.text('Dịch vụ gắn thẻ'), findsOneWidget);
    expect(find.text('0/5'), findsOneWidget);

    // Verify Bottom Toolbar with hashtag chips
    expect(find.byType(FeedComposerBottomToolbar), findsOneWidget);
    expect(find.text('#cắttóc'), findsOneWidget);
    expect(find.text('#nhuộmtóc'), findsOneWidget);

    // Tapping a hashtag appends it to the caption
    await tester.tap(find.text('#cắttóc'));
    await tester.pumpAndSettle();
    expect(find.text('#cắttóc '), findsOneWidget);
  });

  testWidgets('FeedComposerScreen shows review badge when memberId is present',
      (tester) async {
    final workerContext = FeedPublishingContext(
      providerId: 'provider-1',
      memberId: 'worker-member-1',
      offerings: [testOffering],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_FakeAuthRepo()),
          feedPublishingContextProvider
              .overrideWith((ref) => Future.value(workerContext)),
        ],
        child: const MaterialApp(
          home: FeedComposerScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.text('Cơ sở phê duyệt trước'), findsOneWidget);
    expect(find.byIcon(Icons.verified_user_outlined), findsOneWidget);
  });

  testWidgets(
      'FeedComposerMediaGrid renders single image with natural full-width layout without forced AspectRatio',
      (tester) async {
    final testFile = XFile('test_photo.jpg');

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: FeedComposerMediaGrid(
            files: [testFile],
            disabled: false,
            pick: (_) async {},
            onRemove: (_) {},
            onClear: () {},
          ),
        ),
      ),
    );
    await tester.pump();

    // Verify 1 ảnh badge
    expect(find.text('1 ảnh'), findsOneWidget);
    // Verify delete button
    expect(find.byIcon(Icons.close_rounded), findsOneWidget);
    // Verify it is not forced into an AspectRatio 4/3 widget!
    expect(find.byType(AspectRatio), findsNothing);
  });
}


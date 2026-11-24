import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:video_player/video_player.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/customer/booking/domain/entities/provider_booking_entry.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';
import 'package:mobile/features/customer/catalog/domain/repositories/catalog_repository.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/catalog_providers.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';
import 'package:mobile/features/shared/profile/domain/repositories/partner_profile_repository.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_booking_actions.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';
import 'package:mobile/features/shared/beauty_feed/di/feed_providers.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_mapper.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_scope.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_post_card.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_comments_bottom_sheet.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_comment_thread.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/screens/feed_video_screen.dart';
import 'package:mobile/features/customer/ai_consultation/presentation/screens/ai_inspiration_post_screen.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_sub_nav_header.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_media_gallery.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_autoplay_video_player.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/screens/feed_screen.dart';
import 'package:mobile/features/customer/home/presentation/providers/home_categories_provider.dart';

import 'feed_fixture.dart';

class FeedTestAuth implements AuthRepository {
  String id = 'user-1';
  @override
  Future<UserEntity?> getCurrentUser() async =>
      UserEntity(id: id, roles: const ['CUSTOMER']);
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Profile extends Fake implements PartnerProfileRepository {
  bool active = true;
  @override
  Future<PartnerPublicProfileEntity> getPublicProfile(
    String providerId,
  ) async => PartnerPublicProfileEntity(
    id: providerId,
    displayName: 'An',
    biography: '',
    experienceYears: 2,
    serviceAreaName: 'Hà Nội',
    serviceRadiusKm: 10,
    services: active
        ? const [
            PublicServiceItemEntity(
              id: 'offering-1',
              serviceId: 'catalog-1',
              name: 'Cắt tóc',
              slug: 'cat-toc',
              categoryName: 'Tóc',
              categorySlug: 'toc',
              priceAmount: 190000,
              durationMinutes: 45,
            ),
          ]
        : const [],
  );
}

class _Catalog extends Fake implements CatalogRepository {
  @override
  Future<ServiceItemEntity> getServiceBySlug(String slug) async =>
      const ServiceItemEntity(
        id: 'catalog-1',
        code: 'HAIR',
        name: 'Cắt tóc',
        slug: 'cat-toc',
        minPriceAmount: 100000,
        maxPriceAmount: 300000,
        category: ServiceCategorySummaryEntity(
          id: 'category-1',
          code: 'HAIR',
          name: 'Tóc',
          slug: 'toc',
        ),
      );
}

void main() {
  for (final available in [true, false]) {
    testWidgets(
      'booking CTA reads fresh offering and ${available ? 'opens existing booking configuration' : 'blocks revoked service'}',
      (tester) async {
        final profile = _Profile()..active = available;
        ProviderBookingEntry? entry;
        final router = GoRouter(
          routes: [
            GoRoute(
              path: '/',
              builder: (_, _) =>
                  Scaffold(body: FeedBookingActions(post: post())),
            ),
            GoRoute(
              path: '/booking/config',
              builder: (_, state) {
                entry = state.extra as ProviderBookingEntry;
                return const Scaffold(body: Text('Cấu hình đặt lịch'));
              },
            ),
          ],
        );
        addTearDown(router.dispose);
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authRepositoryProvider.overrideWithValue(FeedTestAuth()),
              partnerProfileRepositoryProvider.overrideWithValue(profile),
              catalogRepositoryProvider.overrideWithValue(_Catalog()),
            ],
            child: MaterialApp.router(routerConfig: router),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Đặt dịch vụ'));
        await tester.pumpAndSettle();
        if (available) {
          expect(entry?.providerId, 'provider-1');
          expect(entry?.providerServiceId, 'offering-1');
          expect(entry?.service.id, 'catalog-1');
          expect(
            entry?.priceAmount,
            190000,
          ); // Fresh offering, not stale Feed's 150000.
        } else {
          expect(entry, isNull);
          expect(find.textContaining('Dịch vụ vừa thay đổi'), findsOneWidget);
        }
      },
    );
  }
  testWidgets('public card fits a small screen without fabricated counters', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final repo = FakeFeedRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(FeedTestAuth()),
          feedRepositoryProvider.overrideWithValue(repo),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: FeedPostCard(
                post: feedPostFromJson({...postJson(), 'media': []}),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('3 Thích'), findsOneWidget);
    expect(find.text('1 Bình luận'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('3 Thích'));
    await tester.pumpAndSettle();
    expect(find.text('4 Thích'), findsOneWidget);
    expect(repo.reactCalls, 1);
  });
  testWidgets(
    'managed pending card shows review state without public like or save controls',
    (tester) async {
      final repo = FakeFeedRepository();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(FeedTestAuth()),
            feedRepositoryProvider.overrideWithValue(repo),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: FeedPostCard(
                  manage: true,
                  detail: true,
                  post: feedPostFromJson({
                    ...postJson(review: 'PENDING'),
                    'media': [],
                  }, managed: true),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Chờ tổ chức duyệt'), findsOneWidget);
      expect(find.text('Lưu'), findsNothing);
      expect(find.textContaining('Thích'), findsNothing);
    },
  );
  testWidgets(
    'comment tombstone keeps replies and delete control appears only for own comment',
    (tester) async {
      final root = feedCommentFromJson({
        ...commentJson(id: 'root', deleted: true),
        'replyCount': 1,
        'replies': [
          {
            ...commentJson(id: 'reply', parent: 'root'),
            'user': {'id': 'someone-else', 'fullName': 'Người khác'},
          },
        ],
      });
      await tester.pumpWidget(
        ProviderScope(
          overrides: [authRepositoryProvider.overrideWithValue(FeedTestAuth())],
          child: MaterialApp(
            home: Scaffold(
              body: FeedCommentThread(
                postId: 'post-1',
                parent: root,
                reply: (_) {},
                remove: (_) {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Bình luận đã xóa'), findsOneWidget);
      expect(find.text('Rất đẹp'), findsOneWidget);
      expect(find.byTooltip('Xóa bình luận'), findsNothing);
      expect(find.text('Trả lời'), findsNothing);
    },
  );
  testWidgets('own visible comment exposes delete and root reply controls', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(FeedTestAuth())],
        child: MaterialApp(
          home: Scaffold(
            body: FeedCommentThread(
              postId: 'post-1',
              parent: feedCommentFromJson(commentJson()),
              reply: (_) {},
              remove: (_) {},
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byTooltip('Xóa bình luận'), findsOneWidget);
    expect(find.text('Trả lời'), findsOneWidget);
  });
  testWidgets(
    'AI inspiration uses authenticated typed Feed detail and respects visibility loss',
    (tester) async {
      final repo = FakeFeedRepository()
        ..onDetail = (_) async =>
            feedPostFromJson({...postJson(), 'media': []});
      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(FeedTestAuth()),
          feedRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authNotifierProvider.notifier).refreshSession();
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: AiInspirationPostScreen(postId: 'post-1'),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Tóc cho buổi hẹn'), findsOneWidget);
      repo.onDetail = (_) => Future.error(failure(404));
      await container
          .read(feedDetailProvider(const FeedDetailScope('post-1')).notifier)
          .load();
      await tester.pumpAndSettle();
      expect(find.text('Tóc cho buổi hẹn'), findsNothing);
    },
  );
  testWidgets('video detail creates no native decoder until explicit play', (
    tester,
  ) async {
    final repo = FakeFeedRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(FeedTestAuth()),
          feedRepositoryProvider.overrideWithValue(repo),
        ],
        child: const MaterialApp(
          home: FeedVideoScreen(postId: 'post-1', mediaId: 'media-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(VideoPlayer), findsNothing);
    expect(find.text('Phát video'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  test(
    'switching account disposes cached lists and cancels their requests',
    () async {
      final auth = FeedTestAuth(), repo = FakeFeedRepository();
      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(auth),
          feedRepositoryProvider.overrideWithValue(repo),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authNotifierProvider.notifier).refreshSession();
      final subscription = container.listen(
        feedListProvider(const FeedScope(mode: FeedMode.saved)),
        (_, _) {},
      );
      addTearDown(subscription.close);
      final old = container.read(
        feedListProvider(const FeedScope(mode: FeedMode.saved)).notifier,
      );
      await Future<void>.delayed(Duration.zero);
      auth.id = 'user-2';
      await container.read(authNotifierProvider.notifier).refreshSession();
      await Future<void>.delayed(Duration.zero);
      final next = container.read(
        feedListProvider(const FeedScope(mode: FeedMode.saved)).notifier,
      );
      expect(identical(old, next), isFalse);
      expect(old.cancel.isCancelled, isTrue);
    },
  );

  testWidgets(
    'sub nav header fits a small screen with all tabs without overflow',
    (tester) async {
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      FeedMode currentMode = FeedMode.all;
      String? currentCategory;

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Scaffold(
              body: FeedSubNavHeader(
                selectedMode: currentMode,
                onModeChanged: (m) => currentMode = m,
                selectedCategorySlug: currentCategory,
                onCategoryChanged: (c) => currentCategory = c,
                showSavedAndMine: true,
                onSearchTap: () {},
                onComposeTap: () {},
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Khám phá'), findsOneWidget);
      expect(find.text('Đang theo dõi'), findsOneWidget);
      expect(find.text('Đã lưu'), findsOneWidget);
      expect(find.text('Của tôi'), findsOneWidget);
      expect(find.byIcon(Icons.search_rounded), findsOneWidget);
      expect(find.byIcon(Icons.edit_square), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'FeedMediaGallery calculates natural aspect ratio from media dimensions without cropping',
    (tester) async {
      final portraitPost = feedPostFromJson({
        ...postJson(id: 'portrait-post'),
        'media': [
          {
            'id': 'media-portrait',
            'kind': 'IMAGE',
            'url': 'https://example.test/portrait.png',
            'position': 0,
            'width': 1080,
            'height': 1440, // 3:4 portrait (0.75)
          },
        ],
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FeedMediaGallery(post: portraitPost),
          ),
        ),
      );
      await tester.pump();

      final aspectRatioFinder = find.byWidgetPredicate(
        (widget) => widget is AspectRatio,
      );
      expect(aspectRatioFinder, findsWidgets);
      final AspectRatio portraitWidget =
          tester.widget<AspectRatio>(aspectRatioFinder.first);
      expect(portraitWidget.aspectRatio, closeTo(1080 / 1440, 0.001));

      // Test Landscape 16:9 post
      final landscapePost = feedPostFromJson({
        ...postJson(id: 'landscape-post'),
        'media': [
          {
            'id': 'media-landscape',
            'kind': 'IMAGE',
            'url': 'https://example.test/landscape.png',
            'position': 0,
            'width': 1920,
            'height': 1080, // 16:9 landscape (1.777)
          },
        ],
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FeedMediaGallery(post: landscapePost),
          ),
        ),
      );
      await tester.pump();

      final AspectRatio landscapeWidget =
          tester.widget<AspectRatio>(aspectRatioFinder.first);
      expect(landscapeWidget.aspectRatio, closeTo(1920 / 1080, 0.001));
    },
  );

  testWidgets(
    'FeedMediaGallery sets frame ratio to largest image when multiple images have different dimensions',
    (tester) async {
      final multiImagePost = feedPostFromJson({
        ...postJson(id: 'multi-size-post'),
        'media': [
          {
            'id': 'media-small',
            'kind': 'IMAGE',
            'url': 'https://example.test/small.png',
            'position': 0,
            'width': 600,
            'height': 400, // 3:2 landscape (1.5)
          },
          {
            'id': 'media-large',
            'kind': 'IMAGE',
            'url': 'https://example.test/large.png',
            'position': 1,
            'width': 1080,
            'height': 1440, // 3:4 portrait (0.75) - Dominant largest image!
          },
        ],
      });

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FeedMediaGallery(post: multiImagePost),
          ),
        ),
      );
      await tester.pump();

      // Verify that the gallery frame is set to the largest image (0.75), NOT the smaller first image (1.5)!
      final aspectRatioFinder = find.byWidgetPredicate(
        (widget) => widget is AspectRatio,
      );
      expect(aspectRatioFinder, findsWidgets);
      final AspectRatio galleryWidget =
          tester.widget<AspectRatio>(aspectRatioFinder.first);
      expect(galleryWidget.aspectRatio, closeTo(1080 / 1440, 0.001));

      // Verify PageView renders 2 items
      expect(find.byType(PageView), findsOneWidget);
    },
  );

  testWidgets(
    'FeedScreen pins FeedSubNavHeader at top without top AppBar',
    (tester) async {
      final repo = FakeFeedRepository();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(FeedTestAuth()),
            feedRepositoryProvider.overrideWithValue(repo),
            homeCategoriesProvider
                .overrideWith((ref) => Future.value(kDefaultCoreCategories)),
          ],
          child: const MaterialApp(
            home: FeedScreen(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));

      // Verify FeedSubNavHeader is present (pinned tabs)
      expect(find.byType(FeedSubNavHeader), findsOneWidget);
      expect(find.text('Khám phá'), findsOneWidget);
      expect(find.text('Đang theo dõi'), findsOneWidget);
      expect(find.byIcon(Icons.search_rounded), findsOneWidget);

      // Verify FeedFacebookComposerCard is NOT in feed list
      expect(find.text('Chia sẻ tác phẩm làm đẹp mới...'), findsNothing);

      // Verify AppBar and SliverAppBar are NOT present
      expect(find.byType(AppBar), findsNothing);
      expect(find.byType(SliverAppBar), findsNothing);
    },
  );

  testWidgets(
    'FeedAutoplayVideoPlayer initializes with audio on by default',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: FeedAutoplayVideoPlayer(
              url: 'https://example.test/test_video.mp4',
              duration: 15.0,
            ),
          ),
        ),
      );
      await tester.pump();

      // Volume button should NOT show muted icon initially
      expect(find.byIcon(Icons.volume_off_rounded), findsNothing);
    },
  );

  testWidgets(
    'tapping comment button on FeedPostCard opens Facebook-style FeedCommentsBottomSheet',
    (tester) async {
      final repo = FakeFeedRepository();
      repo.onComments = (cursor, parentId) => Future.value(
        FeedPage(
          [feedCommentFromJson({...commentJson(), 'text': 'Màu sơn đẹp quá'})],
          null,
        ),
      );

      final post = feedPostFromJson({
        ...postJson(id: 'post-with-comments'),
        'counts': {'likes': 10, 'comments': 5, 'saves': 2},
        'media': [],
      });

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(FeedTestAuth()),
            feedRepositoryProvider.overrideWithValue(repo),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: FeedPostCard(post: post),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Find the comment action button on FeedPostCard
      expect(find.text('5 Bình luận'), findsOneWidget);

      // Tap on comment button
      await tester.tap(find.text('5 Bình luận'));
      await tester.pumpAndSettle();

      // Verify FeedCommentsBottomSheet opened as modal sheet
      expect(find.byType(FeedCommentsBottomSheet), findsOneWidget);
      expect(find.text('Bình luận'), findsOneWidget);
      expect(find.text('Màu sơn đẹp quá'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
      expect(find.byIcon(Icons.close_rounded), findsOneWidget);

      // Tap close button on the bottom sheet
      await tester.tap(find.byIcon(Icons.close_rounded));
      await tester.pumpAndSettle();

      // Verify bottom sheet closed and user remains on post card
      expect(find.byType(FeedCommentsBottomSheet), findsNothing);
      expect(find.text('5 Bình luận'), findsOneWidget);
    },
  );
}

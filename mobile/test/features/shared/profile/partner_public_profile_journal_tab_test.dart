import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/beauty_feed/application/feed_interactions_controller.dart';
import 'package:mobile/features/shared/beauty_feed/application/feed_list_controller.dart';
import 'package:mobile/features/shared/beauty_feed/data/feed_repository.dart';
import 'package:mobile/features/shared/beauty_feed/di/feed_providers.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_post.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_scope.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_post_card.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';
import 'package:mobile/features/shared/profile/presentation/widgets/public_profile/public_profile_portfolio_tab.dart';

class _FakeFeedRepo implements FeedRepository {
  @override
  Dio get dio => Dio();
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _TestFeedListNotifier extends FeedListController {
  _TestFeedListNotifier(List<FeedPost> posts)
      : super(
          _FakeFeedRepo(),
          FeedInteractionsController(_FakeFeedRepo()),
          const FeedScope(providerId: 'prov-001'),
          true,
        ) {
    state = FeedListState(items: posts, loaded: true);
  }

  @override
  Future<void> load({bool refresh = false}) async {}
}

void main() {
  final mockPost = FeedPost(
    id: 'post-test-1',
    caption: 'Kiểu tóc Layer uốn sóng nhẹ nhàng cho mùa hè',
    status: 'PUBLISHED',
    sharePath: '/feed/posts/post-test-1',
    provider: const FeedIdentity('prov-001', 'Lê Hoàng Yến', null),
    media: const [
      FeedMedia(
        id: 'med-1',
        kind: 'IMAGE',
        url: 'https://example.com/photo1.jpg',
        position: 0,
      ),
      FeedMedia(
        id: 'med-2',
        kind: 'VIDEO',
        url: 'https://example.com/video1.mp4',
        position: 1,
      ),
    ],
    services: const [
      FeedService(
        id: 'svc-1',
        serviceId: 's-1',
        name: 'Uốn tóc Layer',
        status: 'ACTIVE',
        price: 350000,
      ),
    ],
    revision: 1,
    likes: 85,
    comments: 12,
    saves: 5,
    liked: false,
    saved: false,
    followed: false,
    managed: false,
    createdAt: DateTime.now().subtract(const Duration(hours: 2)),
    updatedAt: DateTime.now().subtract(const Duration(hours: 2)),
  );

  final mockProfile = const PartnerPublicProfileEntity(
    id: 'prov-001',
    displayName: 'Lê Hoàng Yến',
    biography: 'Chuyên gia tạo mẫu tóc',
    experienceYears: 6,
    serviceAreaName: 'TP. Hồ Chí Minh',
    serviceRadiusKm: 10,
    services: [],
    reviews: [],
    portfolio: [
      PublicPortfolioItemEntity(
        id: 'port-old-1',
        title: 'Mẫu tóc cũ',
        imageUrl: 'https://example.com/old.jpg',
        likesCount: 10,
      ),
    ],
  );

  testWidgets(
    'PublicProfilePortfolioTab displays feed posts with dual view mode toggle',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            feedListProvider(const FeedScope(providerId: 'prov-001'))
                .overrideWith((ref) => _TestFeedListNotifier([mockPost])),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: PublicProfilePortfolioTab(profile: mockProfile),
              ),
            ),
          ),
        ),
      );

      await tester.pump();

      // Header shows 1 tác phẩm from feed
      expect(find.text('Nhật ký làm đẹp (1 tác phẩm)'), findsOneWidget);

      // Switcher buttons exist
      expect(find.byIcon(Icons.grid_view_rounded), findsOneWidget);
      expect(find.byIcon(Icons.view_agenda_rounded), findsOneWidget);

      // In default Grid view:
      expect(find.byType(GridView), findsOneWidget);
      expect(find.text('85'), findsOneWidget); // like count
      expect(find.byIcon(Icons.play_arrow_rounded), findsOneWidget); // video badge

      // Switch to Feed view
      await tester.tap(find.byIcon(Icons.view_agenda_rounded));
      await tester.pump();

      // In Feed view: FeedPostCard is rendered
      expect(find.byType(FeedPostCard), findsOneWidget);
      expect(
        find.textContaining('Kiểu tóc Layer uốn sóng'),
        findsOneWidget,
      );
      expect(find.text('Uốn tóc Layer'), findsOneWidget);
      expect(find.text('Đặt dịch vụ'), findsOneWidget);
    },
  );

  testWidgets(
    'PublicProfilePortfolioTab falls back to profile.portfolio when feed is empty',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            feedListProvider(const FeedScope(providerId: 'prov-001'))
                .overrideWith((ref) => _TestFeedListNotifier([])),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SingleChildScrollView(
                child: PublicProfilePortfolioTab(profile: mockProfile),
              ),
            ),
          ),
        ),
      );

      await tester.pump();

      // Header shows 1 tác phẩm from fallback portfolio
      expect(find.text('Nhật ký làm đẹp (1 tác phẩm)'), findsOneWidget);
      expect(find.text('10'), findsOneWidget); // fallback like count
    },
  );
}

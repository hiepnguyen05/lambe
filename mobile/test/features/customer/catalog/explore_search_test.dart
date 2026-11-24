import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/explore_search_provider.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/recent_searches_provider.dart';

void main() {
  group('RecentSearchesNotifier Tests', () {
    late RecentSearchesNotifier notifier;

    setUp(() {
      notifier = RecentSearchesNotifier();
    });

    test('new account starts with empty recent history', () {
      expect(notifier.state, isEmpty);
      expect(notifier.state, equals(kDefaultRecentSearches));
    });

    test('addSearch adds new query to the front and prevents duplicates', () {
      notifier.addSearch('Uốn tóc sóng lơi');
      expect(notifier.state.first, equals('Uốn tóc sóng lơi'));

      // Re-adding the same search moves it to front without duplicating
      notifier.addSearch('Massage cổ vai gáy');
      notifier.addSearch('Uốn tóc sóng lơi');
      expect(notifier.state.first, equals('Uốn tóc sóng lơi'));
      expect(
        notifier.state.where((item) => item == 'Uốn tóc sóng lơi').length,
        equals(1),
      );
    });

    test('removeSearch removes a specific query', () {
      notifier.addSearch('Sơn gel móng tay');
      expect(notifier.state, contains('Sơn gel móng tay'));

      notifier.removeSearch('Sơn gel móng tay');
      expect(notifier.state, isNot(contains('Sơn gel móng tay')));
    });

    test('clearAll clears the entire list', () {
      notifier.clearAll();
      expect(notifier.state.isEmpty, isTrue);
    });
  });

  group('ExploreSearchFilterNotifier Tests', () {
    late ExploreSearchFilterNotifier notifier;

    setUp(() {
      notifier = ExploreSearchFilterNotifier();
    });

    test('initial state has default values', () {
      expect(notifier.state.searchQuery, isEmpty);
      expect(notifier.state.selectedChipId, equals('all'));
      expect(notifier.state.maxDistanceKm, isNull);
      expect(notifier.state.minRating, isNull);
      expect(notifier.state.categorySlug, isNull);
      expect(notifier.state.maxPriceAmount, isNull);
    });

    test('setSearchQuery updates query with trimming', () {
      notifier.setSearchQuery('  cắt tóc nam  ');
      expect(notifier.state.searchQuery, equals('cắt tóc nam'));
    });

    test('selectChip handles nearMe filter and toggle', () {
      const nearMeChip = QuickFilterChipItem(
        id: 'near_me',
        label: 'Gần bạn (< 3km)',
        type: QuickFilterChipType.nearMe,
      );

      notifier.selectChip(nearMeChip);
      expect(notifier.state.selectedChipId, equals('near_me'));
      expect(notifier.state.maxDistanceKm, equals(3.0));

      // Toggle off -> returns to 'all'
      notifier.selectChip(nearMeChip);
      expect(notifier.state.selectedChipId, equals('all'));
      expect(notifier.state.maxDistanceKm, isNull);
    });

    test('selectChip handles highRating filter', () {
      const ratingChip = QuickFilterChipItem(
        id: 'high_rating',
        label: 'Đánh giá 4.9★+',
        type: QuickFilterChipType.highRating,
      );

      notifier.selectChip(ratingChip);
      expect(notifier.state.selectedChipId, equals('high_rating'));
      expect(notifier.state.minRating, equals(4.9));
    });

    test('selectChip handles category filter', () {
      const categoryChip = QuickFilterChipItem(
        id: 'cat_toc',
        label: 'Cắt tóc',
        type: QuickFilterChipType.category,
        categorySlug: 'toc',
      );

      notifier.selectChip(categoryChip);
      expect(notifier.state.selectedChipId, equals('cat_toc'));
      expect(notifier.state.categorySlug, equals('toc'));
    });

    test('setMaxPriceAmount sets and clears max price', () {
      notifier.setMaxPriceAmount(250000);
      expect(notifier.state.maxPriceAmount, equals(250000));

      notifier.setMaxPriceAmount(null);
      expect(notifier.state.maxPriceAmount, isNull);
    });

    test('reset clears all filters back to default', () {
      notifier.setSearchQuery('uốn tóc');
      notifier.setMaxPriceAmount(500000);
      notifier.reset();

      expect(notifier.state.searchQuery, isEmpty);
      expect(notifier.state.maxPriceAmount, isNull);
      expect(notifier.state.selectedChipId, equals('all'));
    });
  });
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

enum QuickFilterChipType { all, category, nearMe, highRating }

class QuickFilterChipItem {
  final String id;
  final String label;
  final QuickFilterChipType type;
  final String? iconName;
  final String? categorySlug;

  const QuickFilterChipItem({
    required this.id,
    required this.label,
    required this.type,
    this.iconName,
    this.categorySlug,
  });
}

class ExploreSearchFilterState {
  final String searchQuery;
  final String selectedChipId;
  final double? maxDistanceKm;
  final double? minRating;
  final String? categorySlug;
  final int? maxPriceAmount;

  const ExploreSearchFilterState({
    this.searchQuery = '',
    this.selectedChipId = 'all',
    this.maxDistanceKm,
    this.minRating,
    this.categorySlug,
    this.maxPriceAmount,
  });

  ExploreSearchFilterState copyWith({
    String? searchQuery,
    String? selectedChipId,
    double? maxDistanceKm,
    bool clearMaxDistance = false,
    double? minRating,
    bool clearMinRating = false,
    String? categorySlug,
    bool clearCategorySlug = false,
    int? maxPriceAmount,
    bool clearMaxPrice = false,
  }) {
    return ExploreSearchFilterState(
      searchQuery: searchQuery ?? this.searchQuery,
      selectedChipId: selectedChipId ?? this.selectedChipId,
      maxDistanceKm: clearMaxDistance
          ? null
          : (maxDistanceKm ?? this.maxDistanceKm),
      minRating: clearMinRating ? null : (minRating ?? this.minRating),
      categorySlug: clearCategorySlug
          ? null
          : (categorySlug ?? this.categorySlug),
      maxPriceAmount: clearMaxPrice
          ? null
          : (maxPriceAmount ?? this.maxPriceAmount),
    );
  }
}

class ExploreSearchFilterNotifier
    extends StateNotifier<ExploreSearchFilterState> {
  ExploreSearchFilterNotifier() : super(const ExploreSearchFilterState());

  void setSearchQuery(String query) {
    state = state.copyWith(searchQuery: query.trim());
  }

  void setMaxPriceAmount(int? maxPrice) {
    if (maxPrice == null) {
      state = state.copyWith(clearMaxPrice: true);
    } else {
      state = state.copyWith(maxPriceAmount: maxPrice);
    }
  }

  void setCategorySlug(String? slug) {
    if (slug == null || slug.isEmpty) {
      state = state.copyWith(selectedChipId: 'all', clearCategorySlug: true);
    } else {
      state = state.copyWith(selectedChipId: 'cat_$slug', categorySlug: slug);
    }
  }

  void selectChip(QuickFilterChipItem chip) {
    if (state.selectedChipId == chip.id) {
      // Toggle off -> quay về "Tất cả"
      state = state.copyWith(
        selectedChipId: 'all',
        clearMaxDistance: true,
        clearMinRating: true,
        clearCategorySlug: true,
      );
      return;
    }

    switch (chip.type) {
      case QuickFilterChipType.all:
        state = state.copyWith(
          selectedChipId: 'all',
          clearMaxDistance: true,
          clearMinRating: true,
          clearCategorySlug: true,
        );
        break;
      case QuickFilterChipType.nearMe:
        state = state.copyWith(
          selectedChipId: chip.id,
          maxDistanceKm: 3.0,
          clearMinRating: true,
        );
        break;
      case QuickFilterChipType.highRating:
        state = state.copyWith(
          selectedChipId: chip.id,
          minRating: 4.9,
          clearMaxDistance: true,
        );
        break;
      case QuickFilterChipType.category:
        state = state.copyWith(
          selectedChipId: chip.id,
          categorySlug: chip.categorySlug,
        );
        break;
    }
  }

  void reset() {
    state = const ExploreSearchFilterState();
  }
}

final exploreSearchFilterProvider =
    StateNotifierProvider.autoDispose<
      ExploreSearchFilterNotifier,
      ExploreSearchFilterState
    >((ref) {
      return ExploreSearchFilterNotifier();
    });

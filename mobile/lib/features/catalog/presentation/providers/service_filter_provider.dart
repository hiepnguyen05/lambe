import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/service_filter_params.dart';

class ServiceFilterNotifier extends StateNotifier<ServiceFilterParams> {
  ServiceFilterNotifier([ServiceFilterParams? initial])
      : super(initial ?? const ServiceFilterParams());

  void setCategorySlug(String? slug) {
    if (state.categorySlug == slug) return;
    state = state.copyWith(
      categorySlug: slug,
      clearCategorySlug: slug == null || slug.isEmpty,
    );
  }

  void setTargetAudience(String? audience) {
    if (state.targetAudience == audience) return;
    state = state.copyWith(
      targetAudience: audience,
      clearTargetAudience: audience == null || audience.isEmpty || audience == 'ALL',
    );
  }

  void setSearch(String? search) {
    final trimmed = search?.trim();
    if (state.search == trimmed) return;
    state = state.copyWith(
      search: trimmed,
      clearSearch: trimmed == null || trimmed.isEmpty,
    );
  }

  void setMaxPriceAmount(int? maxPrice) {
    if (state.maxPriceAmount == maxPrice) return;
    state = state.copyWith(
      maxPriceAmount: maxPrice,
      clearMaxPriceAmount: maxPrice == null || maxPrice <= 0,
    );
  }

  void resetFilters({String? keepCategorySlug}) {
    state = ServiceFilterParams(categorySlug: keepCategorySlug);
  }
}

final serviceFilterProvider =
    StateNotifierProvider.autoDispose<ServiceFilterNotifier, ServiceFilterParams>((ref) {
  return ServiceFilterNotifier();
});

import 'package:equatable/equatable.dart';

class ServiceFilterParams extends Equatable {
  final String? categorySlug;
  final String? targetAudience;
  final String? search;
  final int? maxPriceAmount;

  const ServiceFilterParams({
    this.categorySlug,
    this.targetAudience,
    this.search,
    this.maxPriceAmount,
  });

  ServiceFilterParams copyWith({
    String? categorySlug,
    bool clearCategorySlug = false,
    String? targetAudience,
    bool clearTargetAudience = false,
    String? search,
    bool clearSearch = false,
    int? maxPriceAmount,
    bool clearMaxPriceAmount = false,
  }) {
    return ServiceFilterParams(
      categorySlug: clearCategorySlug ? null : (categorySlug ?? this.categorySlug),
      targetAudience: clearTargetAudience ? null : (targetAudience ?? this.targetAudience),
      search: clearSearch ? null : (search ?? this.search),
      maxPriceAmount: clearMaxPriceAmount ? null : (maxPriceAmount ?? this.maxPriceAmount),
    );
  }

  Map<String, dynamic> toQueryParams() {
    final map = <String, dynamic>{};
    if (categorySlug != null && categorySlug!.isNotEmpty) {
      map['categorySlug'] = categorySlug;
    }
    if (targetAudience != null && targetAudience!.isNotEmpty && targetAudience != 'ALL') {
      map['targetAudience'] = targetAudience;
    }
    if (search != null && search!.trim().isNotEmpty) {
      map['search'] = search!.trim();
    }
    if (maxPriceAmount != null && maxPriceAmount! > 0) {
      map['maxPriceAmount'] = maxPriceAmount;
    }
    return map;
  }

  bool get hasActiveFilters =>
      (categorySlug != null && categorySlug!.isNotEmpty) ||
      (targetAudience != null && targetAudience != 'ALL') ||
      (search != null && search!.trim().isNotEmpty) ||
      (maxPriceAmount != null && maxPriceAmount! > 0);

  @override
  List<Object?> get props => [
        categorySlug,
        targetAudience,
        search,
        maxPriceAmount,
      ];
}

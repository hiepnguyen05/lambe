import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/utils/vietnamese_search_utils.dart';
import '../../domain/entities/service_item_entity.dart';
import '../providers/services_list_provider.dart';
import '../widgets/cards/service_shimmer_skeleton.dart';
import '../widgets/category_header_app_bar.dart';
import '../widgets/category_service_card.dart';
import '../widgets/filters/service_price_filter_modal.dart';
import '../../../home/presentation/providers/home_categories_provider.dart';

/// Màn hình Danh Sách Dịch Vụ dạng Stack Screen (`/services`).
/// Thiết kế 100% khớp theo mẫu HTML: Header có nút Back, ô tìm kiếm + nút bộ lọc tròn,
/// danh mục tabs cuộn ngang, thanh đếm trạng thái, và danh sách thẻ dịch vụ có thumbnail 56x56 + nút "Đặt ngay".
class CategoryServicesScreen extends ConsumerStatefulWidget {
  final String? initialCategorySlug;
  final String? initialCategoryName;

  const CategoryServicesScreen({
    super.key,
    this.initialCategorySlug,
    this.initialCategoryName,
  });

  @override
  ConsumerState<CategoryServicesScreen> createState() =>
      _CategoryServicesScreenState();
}

class _CategoryServicesScreenState
    extends ConsumerState<CategoryServicesScreen> {
  late final TextEditingController _searchCtrl;
  final FocusNode _searchFocus = FocusNode();
  String _activeCategorySlug = 'all';
  int? _maxPriceAmount;
  String _searchQuery = '';
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    _searchCtrl = TextEditingController();

    if (widget.initialCategorySlug != null &&
        widget.initialCategorySlug!.isNotEmpty) {
      _activeCategorySlug = widget.initialCategorySlug!;
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchCtrl.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 250), () {
      setState(() {
        _searchQuery = value.trim();
      });
    });
  }

  void _onClearSearch() {
    _searchCtrl.clear();
    setState(() {
      _searchQuery = '';
    });
  }

  void _onSelectCategory(String slug) {
    setState(() {
      _activeCategorySlug = slug;
    });
  }

  void _resetAllFilters() {
    _searchCtrl.clear();
    setState(() {
      _searchQuery = '';
      _activeCategorySlug = 'all';
      _maxPriceAmount = null;
    });
  }

  List<ServiceItemEntity> _filterServices(List<ServiceItemEntity> all) {
    return all.where((service) {
      // 1. Lọc theo danh mục
      if (_activeCategorySlug != 'all' && _activeCategorySlug.isNotEmpty) {
        final matchesSlug = service.category.slug == _activeCategorySlug ||
            service.category.id == _activeCategorySlug;
        if (!matchesSlug) return false;
      }

      // 2. Lọc theo giá tối đa
      if (_maxPriceAmount != null && _maxPriceAmount! > 0) {
        if (service.minPriceAmount > _maxPriceAmount!) return false;
      }

      // 3. Lọc theo từ khóa tìm kiếm (hỗ trợ tiếng Việt không dấu & có dấu)
      if (_searchQuery.isNotEmpty) {
        final matchesText =
            VietnameseSearchUtils.matches(service.name, _searchQuery) ||
            VietnameseSearchUtils.matches(service.description ?? '', _searchQuery) ||
            VietnameseSearchUtils.matches(service.category.name, _searchQuery);

        if (!matchesText) return false;
      }

      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final allServicesAsync = ref.watch(allCatalogServicesProvider);
    final categoriesAsync = ref.watch(homeCategoriesProvider);
    final dynamicCategories = categoriesAsync.valueOrNull ?? [];

    return Scaffold(
      backgroundColor: AppColors.surface, // #F8F9FF
      body: RefreshIndicator(
        color: AppColors.primaryContainer,
        onRefresh: () async {
          ref.invalidate(allCatalogServicesProvider);
          ref.invalidate(homeCategoriesProvider);
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            // 1. Top Header App Bar
            const CategoryHeaderAppBar(),

            // 2. Khu vực Điều khiển Tìm kiếm, Bộ lọc & Tabs Danh mục
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Thanh Tìm kiếm & Nút Bộ lọc (tinh gọn, chiều cao 42px)
                    Row(
                      children: [
                        // Ô tìm kiếm dạng viên thuốc (rounded-full bg-surface-container-lowest)
                        Expanded(
                          child: Container(
                            height: 42,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceContainerLowest, // #FFFFFF
                              borderRadius: BorderRadius.circular(100),
                              border: Border.all(
                                color: AppColors.outlineVariant.withValues(alpha: 0.35),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.03),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: Row(
                              children: [
                                const Icon(
                                  Icons.search_rounded,
                                  size: 18,
                                  color: AppColors.onSurfaceVariant,
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: TextField(
                                    controller: _searchCtrl,
                                    focusNode: _searchFocus,
                                    onChanged: _onSearchChanged,
                                    style: const TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w400,
                                      color: AppColors.onSurface,
                                    ),
                                    decoration: const InputDecoration(
                                      hintText: 'Tìm dịch vụ làm đẹp...',
                                      hintStyle: TextStyle(
                                        fontSize: 13,
                                        color: AppColors.outline,
                                      ),
                                      filled: false,
                                      fillColor: Colors.transparent,
                                      border: InputBorder.none,
                                      enabledBorder: InputBorder.none,
                                      focusedBorder: InputBorder.none,
                                      errorBorder: InputBorder.none,
                                      disabledBorder: InputBorder.none,
                                      isDense: true,
                                      contentPadding: EdgeInsets.zero,
                                    ),
                                  ),
                                ),
                                ValueListenableBuilder<TextEditingValue>(
                                  valueListenable: _searchCtrl,
                                  builder: (context, value, _) {
                                    if (value.text.isEmpty) {
                                      return const SizedBox.shrink();
                                    }
                                    return InkWell(
                                      onTap: _onClearSearch,
                                      borderRadius: BorderRadius.circular(100),
                                      child: const Padding(
                                        padding: EdgeInsets.all(4),
                                        child: Icon(
                                          Icons.cancel_rounded,
                                          size: 16,
                                          color: AppColors.outline,
                                        ),
                                      ),
                                    );
                                  },
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Nút Bộ lọc tròn (42x42 bg-surface-container-low)
                        InkWell(
                          onTap: () {
                            ServicePriceFilterModal.show(
                              context,
                              currentMaxPrice: _maxPriceAmount,
                              onApply: (price) {
                                setState(() {
                                  _maxPriceAmount = price;
                                });
                              },
                            );
                          },
                          borderRadius: BorderRadius.circular(100),
                          child: Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: AppColors.surfaceContainerLow, // #EFF4FF
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: _maxPriceAmount != null
                                    ? AppColors.primaryContainer
                                    : AppColors.outlineVariant.withValues(alpha: 0.3),
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.03),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ],
                            ),
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Icon(
                                  Icons.tune_rounded,
                                  size: 18,
                                  color: _maxPriceAmount != null
                                      ? AppColors.primaryContainer
                                      : AppColors.onSurface,
                                ),
                                if (_maxPriceAmount != null)
                                  Positioned(
                                    top: 8,
                                    right: 8,
                                    child: Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(
                                        color: AppColors.primaryContainer,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Thanh Tabs Danh mục cuộn ngang (Category Tabs)
                    SizedBox(
                      height: 38,
                      child: ListView(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        padding: EdgeInsets.zero,
                        children: [
                          // Tab "Tất cả"
                          _buildCategoryTab(
                            label: 'Tất cả',
                            slug: 'all',
                            isSelected: _activeCategorySlug == 'all',
                          ),

                          // Các danh mục động từ API
                          for (final cat in dynamicCategories)
                            _buildCategoryTab(
                              label: cat.name,
                              slug: cat.slug,
                              isSelected: _activeCategorySlug == cat.slug,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 3. Thanh trạng thái đếm số lượng dịch vụ & Cam kết
            allServicesAsync.when(
              loading: () => const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: ServiceShimmerSkeleton(),
                ),
              ),
              error: (err, _) => SliverToBoxAdapter(
                child: _buildErrorState(context),
              ),
              data: (allServices) {
                final filtered = _filterServices(allServices);

                return SliverMainAxisGroup(
                  slivers: [
                    // Service Counter Status Bar
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            // Số lượng dịch vụ phù hợp
                            Row(
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primaryContainer,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  '${filtered.length} dịch vụ nổi bật',
                                  style: const TextStyle(
                                    fontSize: 12, // font-label-md
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.onSurfaceVariant, // #3E4947
                                  ),
                                ),
                              ],
                            ),

                            // Tag Đặt lịch tận nơi (font-label-sm text-primary)
                            Row(
                              children: const [
                                Icon(
                                  Icons.bolt_rounded,
                                  size: 14,
                                  color: AppColors.primary,
                                ),
                                SizedBox(width: 3),
                                Text(
                                  'Đặt lịch tận nơi',
                                  style: TextStyle(
                                    fontSize: 11, // font-label-sm
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary, // #005C55
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),

                    // Danh sách Thẻ dịch vụ Compact (hoặc Empty State)
                    if (filtered.isEmpty)
                      SliverToBoxAdapter(
                        child: _buildEmptyServicesState(context),
                      )
                    else
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final service = filtered[index];
                              return CategoryServiceCard(
                                service: service,
                                onBookNow: () {
                                  context.push(
                                    '/services/detail?slug=${service.slug}',
                                    extra: service,
                                  );
                                },
                                onTap: () {
                                  context.push(
                                    '/services/detail?slug=${service.slug}',
                                    extra: service,
                                  );
                                },
                              );
                            },
                            childCount: filtered.length,
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  /// Nút Tab danh mục dạng viên thuốc (cat-pill)
  Widget _buildCategoryTab({
    required String label,
    required String slug,
    required bool isSelected,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: () => _onSelectCategory(slug),
        borderRadius: BorderRadius.circular(100),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), // px-4 py-2
          decoration: BoxDecoration(
            color: isSelected
                ? AppColors.primaryContainer // bg-primary-container
                : AppColors.surfaceContainerLowest, // bg-surface-container-lowest
            borderRadius: BorderRadius.circular(100), // rounded-full
            border: Border.all(
              color: isSelected
                  ? AppColors.primaryContainer
                  : AppColors.outlineVariant.withValues(alpha: 0.25),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12, // font-label-md
                fontWeight: FontWeight.w600,
                color: isSelected
                    ? AppColors.onPrimary // text-on-primary (#FFFFFF)
                    : AppColors.onSurfaceVariant, // text-on-surface-variant (#3E4947)
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Màn hình trạng thái rỗng khi không tìm thấy kết quả
  Widget _buildEmptyServicesState(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: AppColors.surfaceContainerHigh,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.spa_rounded,
                size: 32,
                color: AppColors.primaryContainer,
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Không tìm thấy dịch vụ',
              style: TextStyle(
                fontSize: 18, // font-headline-sm
                fontWeight: FontWeight.w600,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Hãy thử tìm từ khóa khác hoặc chuyển danh mục làm đẹp.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14, // font-body-md
                color: AppColors.onSurfaceVariant,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 18),
            ElevatedButton(
              onPressed: _resetAllFilters,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryContainer,
                foregroundColor: AppColors.onPrimary,
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
                elevation: 0,
              ),
              child: const Text(
                'Xem tất cả dịch vụ',
                style: TextStyle(
                  fontSize: 12, // font-label-md
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              size: 44,
              color: AppColors.error,
            ),
            const SizedBox(height: 12),
            const Text(
              'Không thể tải danh sách dịch vụ',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Vui lòng kiểm tra kết nối mạng và thử lại.',
              style: TextStyle(
                fontSize: 13,
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => ref.invalidate(allCatalogServicesProvider),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryContainer,
                foregroundColor: AppColors.onPrimary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
              ),
              child: const Text('Thử lại'),
            ),
          ],
        ),
      ),
    );
  }
}

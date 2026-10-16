import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/utils/vietnamese_search_utils.dart';
import '../../domain/entities/service_item_entity.dart';
import '../providers/selected_services_provider.dart';
import '../providers/service_filter_provider.dart';
import '../providers/services_list_provider.dart';
import '../widgets/service_card.dart';
import '../widgets/service_category_pills.dart';
import '../widgets/service_guarantee_card.dart';
import '../widgets/service_price_filter_modal.dart';
import '../widgets/service_shimmer_skeleton.dart';
import '../widgets/service_sticky_bottom_bar.dart';

class ServicesListScreen extends ConsumerStatefulWidget {
  final String? initialCategorySlug;
  final String? initialCategoryName;

  const ServicesListScreen({
    super.key,
    this.initialCategorySlug,
    this.initialCategoryName,
  });

  @override
  ConsumerState<ServicesListScreen> createState() => _ServicesListScreenState();
}

class _ServicesListScreenState extends ConsumerState<ServicesListScreen> {
  late final TextEditingController _searchCtrl;
  String _currentSearchQuery = '';
  String? _categoryDisplayName;
  bool _showSearchBar = false;

  @override
  void initState() {
    super.initState();
    _searchCtrl = TextEditingController();
    _categoryDisplayName = widget.initialCategoryName;

    // Thiết lập danh mục ban đầu nếu người dùng ấn từ Trang chủ
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (widget.initialCategorySlug != null &&
          widget.initialCategorySlug!.isNotEmpty) {
        ref
            .read(serviceFilterProvider.notifier)
            .setCategorySlug(widget.initialCategorySlug);
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    setState(() {
      _currentSearchQuery = value.trim();
    });
  }

  void _onClearSearch() {
    _searchCtrl.clear();
    setState(() {
      _currentSearchQuery = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final filterState = ref.watch(serviceFilterProvider);
    // Sử dụng allCatalogServicesProvider để có toàn bộ dữ liệu, hỗ trợ tìm kiếm không dấu siêu tốc
    final allServicesAsync = ref.watch(allCatalogServicesProvider);
    final selectedNotifier = ref.read(selectedServicesProvider.notifier);
    final selectedServices = ref.watch(selectedServicesProvider);
    final hasSelection = selectedServices.isNotEmpty;

    final currentTitle = _categoryDisplayName != null && _categoryDisplayName!.isNotEmpty
        ? _categoryDisplayName!
        : 'Dịch vụ làm đẹp';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FD),
      body: Stack(
        children: [
          // 1. Nội dung danh sách dịch vụ chính
          Column(
            children: [
              // Khoảng trống đệm cho Glassmorphic Header phía trên
              SizedBox(
                height: MediaQuery.of(context).padding.top +
                    (_showSearchBar ? 122 : 68),
              ),

              // Thanh chọn danh mục ngang (Horizontal Pills)
              const SizedBox(height: 6),
              ServiceCategoryPills(
                selectedSlug: filterState.categorySlug,
                onSelectCategory: (slug, name) {
                  setState(() => _categoryDisplayName = slug != null ? name : null);
                  ref.read(serviceFilterProvider.notifier).setCategorySlug(slug);
                },
              ),
              const SizedBox(height: 12),

              // Danh sách dịch vụ được lọc thông minh
              Expanded(
                child: allServicesAsync.when(
                  loading: () => const ServiceShimmerSkeleton(),
                  error: (err, _) => _buildErrorState(context),
                  data: (allServices) {
                    // Lọc dữ liệu thông minh kết hợp tiếng Việt có dấu/không dấu
                    final filteredServices = _filterServices(
                      allServices,
                      selectedSlug: filterState.categorySlug,
                      maxPrice: filterState.maxPriceAmount,
                      query: _currentSearchQuery,
                    );

                    if (filteredServices.isEmpty) {
                      return _buildEmptyState(context);
                    }

                    final isSearching = _currentSearchQuery.isNotEmpty;

                    return RefreshIndicator(
                      color: const Color(0xFF0F766E),
                      onRefresh: () async {
                        ref.invalidate(allCatalogServicesProvider);
                        ref.invalidate(servicesListProvider);
                      },
                      child: ListView.builder(
                        padding: EdgeInsets.fromLTRB(
                          16, 4, 16,
                          hasSelection ? 120 : 24,
                        ),
                        itemCount: filteredServices.length + 2, // +1 header, +1 guarantee card
                        itemBuilder: (context, index) {
                          // Header row
                          if (index == 0) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          isSearching
                                              ? 'Kết quả tìm kiếm'
                                              : 'Danh sách gói dịch vụ',
                                          style: const TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF0F172A),
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          isSearching
                                              ? 'Từ khóa: "$_currentSearchQuery"'
                                              : 'Nhấn + để chọn dịch vụ bạn cần',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            color: Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFECFDF5),
                                      borderRadius: BorderRadius.circular(100),
                                    ),
                                    child: Text(
                                      '${filteredServices.length} gói có sẵn',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF0F766E),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }

                          // Guarantee card (last item)
                          if (index == filteredServices.length + 1) {
                            return const ServiceGuaranteeCard();
                          }

                          // Service cards
                          final item = filteredServices[index - 1];
                          final isSelected =
                              selectedServices.any((s) => s.id == item.id);
                          return ServiceCard(
                            service: item,
                            isSelected: isSelected,
                            onToggle: () => selectedNotifier.toggle(item),
                            onTap: () {
                              context.push(
                                '/services/detail?slug=${item.slug}',
                                extra: item,
                              );
                            },
                          );
                        },
                      ),
                    );
                  },
                ),
              ),
            ],
          ),

          // 2. Fixed Top Header (Glassmorphic)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: _buildGlassmorphicHeader(
              context,
              currentTitle,
              filterState.maxPriceAmount != null,
            ),
          ),

          // 3. Sticky Bottom Summary Bar & Primary CTA — chỉ hiện khi user đã chọn dịch vụ
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: AnimatedSlide(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOutCubic,
              offset: hasSelection ? Offset.zero : const Offset(0, 1),
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 250),
                opacity: hasSelection ? 1.0 : 0.0,
                child: IgnorePointer(
                  ignoring: !hasSelection,
                  child: ServiceStickyBottomBar(
                    onContinue: _handleContinueToProviders,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Thuật toán lọc dịch vụ thông minh hỗ trợ tiếng Việt không dấu & có dấu
  List<ServiceItemEntity> _filterServices(
    List<ServiceItemEntity> allServices, {
    required String? selectedSlug,
    required int? maxPrice,
    required String query,
  }) {
    List<ServiceItemEntity> result = allServices;

    // 1. Lọc theo mức giá tối đa nếu có cấu hình
    if (maxPrice != null && maxPrice > 0) {
      result = result.where((s) => s.minPriceAmount <= maxPrice).toList();
    }

    // 2. Nếu có từ khóa tìm kiếm
    if (query.isNotEmpty) {
      // Tìm trong danh mục đang chọn trước
      var queryMatched = result.where((s) {
        if (selectedSlug != null &&
            selectedSlug.isNotEmpty &&
            s.category.slug != selectedSlug) {
          return false;
        }
        return VietnameseSearchUtils.matches(s.name, query) ||
            VietnameseSearchUtils.matches(s.description ?? '', query) ||
            VietnameseSearchUtils.matches(s.category.name, query);
      }).toList();

      // Nếu trong danh mục đang chọn không có kết quả, tìm rộng ra TOÀN BỘ salon để người dùng không bị rỗng
      if (queryMatched.isEmpty && selectedSlug != null && selectedSlug.isNotEmpty) {
        queryMatched = result.where((s) {
          return VietnameseSearchUtils.matches(s.name, query) ||
              VietnameseSearchUtils.matches(s.description ?? '', query) ||
              VietnameseSearchUtils.matches(s.category.name, query);
        }).toList();
      }

      return queryMatched;
    }

    // 3. Nếu không tìm kiếm, lọc theo danh mục đã chọn
    if (selectedSlug != null && selectedSlug.isNotEmpty) {
      result = result.where((s) => s.category.slug == selectedSlug).toList();
    }

    return result;
  }

  Widget _buildGlassmorphicHeader(
    BuildContext context,
    String title,
    bool hasActiveFilter,
  ) {
    final topPadding = MediaQuery.of(context).padding.top;

    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.94),
            border: Border(
              bottom: BorderSide(
                color: const Color(0xFFF1F5F9).withValues(alpha: 0.9),
                width: 1,
              ),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 8,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(height: topPadding),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                child: Row(
                  children: [
                    // Nút Quay lại
                    IconButton(
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        size: 22,
                        color: Color(0xFF334155),
                      ),
                      onPressed: () => context.pop(),
                      style: IconButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shape: const CircleBorder(),
                      ),
                    ),
                    const SizedBox(width: 4),

                    // Tiêu đề + Badge online + Phụ đề
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF0F172A),
                                    letterSpacing: -0.3,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 2,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFECFDF5),
                                  borderRadius: BorderRadius.circular(100),
                                ),
                                child: const Text(
                                  'Đang nhận lịch',
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF059669),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 1),
                          const Text(
                            'Dịch vụ làm đẹp tận nhà chuẩn salon',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Nút Tìm kiếm
                    IconButton(
                      icon: Icon(
                        _showSearchBar
                            ? Icons.close_rounded
                            : Icons.search_rounded,
                        size: 20,
                        color: _showSearchBar || _currentSearchQuery.isNotEmpty
                            ? const Color(0xFF0F766E)
                            : const Color(0xFF334155),
                      ),
                      onPressed: () {
                        setState(() {
                          _showSearchBar = !_showSearchBar;
                          if (!_showSearchBar && _currentSearchQuery.isNotEmpty) {
                            _onClearSearch();
                          }
                        });
                      },
                      style: IconButton.styleFrom(
                        backgroundColor:
                            _showSearchBar || _currentSearchQuery.isNotEmpty
                                ? const Color(0xFF0F766E).withValues(alpha: 0.1)
                                : const Color(0xFFF1F5F9),
                        shape: const CircleBorder(),
                      ),
                    ),
                    const SizedBox(width: 4),

                    // Nút Bộ lọc giá
                    IconButton(
                      icon: Icon(
                        Icons.tune_rounded,
                        size: 19,
                        color: hasActiveFilter
                            ? const Color(0xFF0F766E)
                            : const Color(0xFF334155),
                      ),
                      onPressed: () {
                        final filter = ref.read(serviceFilterProvider);
                        ServicePriceFilterModal.show(
                          context,
                          currentMaxPrice: filter.maxPriceAmount,
                          onApply: (price) {
                            ref
                                .read(serviceFilterProvider.notifier)
                                .setMaxPriceAmount(price);
                          },
                        );
                      },
                      style: IconButton.styleFrom(
                        backgroundColor: hasActiveFilter
                            ? const Color(0xFF0F766E).withValues(alpha: 0.1)
                            : const Color(0xFFF1F5F9),
                        shape: const CircleBorder(),
                      ),
                    ),
                  ],
                ),
              ),

              // Ô nhập tìm kiếm mở rộng mượt mà
              if (_showSearchBar)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(100),
                      border: Border.all(
                        color: _currentSearchQuery.isNotEmpty
                            ? const Color(0xFF0F766E).withValues(alpha: 0.4)
                            : Colors.transparent,
                        width: 1,
                      ),
                    ),
                    child: TextField(
                      controller: _searchCtrl,
                      onChanged: _onSearchChanged,
                      autofocus: true,
                      style: const TextStyle(
                        fontSize: 13.5,
                        color: Color(0xFF0F172A),
                        fontWeight: FontWeight.w500,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Tìm theo tên (ví dụ: cắt tóc, uốn, sơn gel, mi...)',
                        hintStyle: const TextStyle(
                          fontSize: 12.5,
                          color: Color(0xFF94A3B8),
                        ),
                        prefixIcon: const Icon(
                          Icons.search_rounded,
                          size: 19,
                          color: Color(0xFF0F766E),
                        ),
                        suffixIcon: _searchCtrl.text.isNotEmpty
                            ? GestureDetector(
                                onTap: _onClearSearch,
                                child: const Icon(
                                  Icons.close_rounded,
                                  size: 18,
                                  color: Color(0xFF64748B),
                                ),
                              )
                            : null,
                        contentPadding: const EdgeInsets.symmetric(vertical: 12),
                        border: InputBorder.none,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: const Color(0xFF0F766E).withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.search_off_rounded,
                size: 38,
                color: Color(0xFF0F766E),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              _currentSearchQuery.isNotEmpty
                  ? 'Không tìm thấy dịch vụ nào cho "$_currentSearchQuery"'
                  : 'Không có gói dịch vụ phù hợp',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Hãy thử tìm từ khóa khác (ví dụ: cắt tóc, sơn gel, trang điểm) hoặc xóa bộ lọc.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                _onClearSearch();
                ref.read(serviceFilterProvider.notifier).resetFilters();
                setState(() => _categoryDisplayName = null);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F766E),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                elevation: 0,
              ),
              child: const Text('Xem tất cả dịch vụ'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.wifi_off_rounded,
              size: 44,
              color: Color(0xFF94A3B8),
            ),
            const SizedBox(height: 14),
            const Text(
              'Không thể tải danh sách dịch vụ',
              style: TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: () {
                ref.invalidate(allCatalogServicesProvider);
                ref.invalidate(servicesListProvider);
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF0F766E),
                side: const BorderSide(color: Color(0xFF0F766E)),
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

  void _handleContinueToProviders() {
    final selected = ref.read(selectedServicesProvider);
    if (selected.isEmpty) return;

    final names = selected.map((s) => s.name).join(', ');

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đã chọn ${selected.length} dịch vụ: $names. Đang tìm chuyên viên gần bạn...'),
        backgroundColor: const Color(0xFF0F766E),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        action: SnackBarAction(
          label: 'Đóng',
          textColor: Colors.white,
          onPressed: () {},
        ),
      ),
    );
  }
}


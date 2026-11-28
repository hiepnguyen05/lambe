import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/customer/discovery/presentation/nearby_providers_section.dart';
import 'package:mobile/features/shared/address/di/address_providers.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';

import '../../domain/entities/service_item_entity.dart';
import '../providers/catalog_providers.dart';
import '../providers/selected_services_provider.dart';
import '../providers/service_detail_provider.dart';
import '../widgets/detail/service_detail_app_bar.dart';
import '../widgets/detail/service_detail_bottom_bar.dart';
import '../widgets/detail/service_detail_hero.dart';
import '../widgets/detail/service_detail_overview_card.dart';
import '../widgets/detail/service_detail_process_steps.dart';

class ServiceDetailScreen extends ConsumerStatefulWidget {
  final ServiceItemEntity? initialService;
  final String serviceSlug;

  const ServiceDetailScreen({
    super.key,
    this.initialService,
    required this.serviceSlug,
  });

  @override
  ConsumerState<ServiceDetailScreen> createState() =>
      _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends ConsumerState<ServiceDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final loc = ref.read(userLocationProvider);
      if (!loc.isLoaded) {
        ref.read(userLocationProvider.notifier).fetchLocation();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final slug = widget.serviceSlug.isNotEmpty
        ? widget.serviceSlug
        : (widget.initialService?.slug ?? '');

    // Nếu có initialService thì dùng ngay để hiển thị tức thì, song song gọi API lấy dữ liệu mới nhất
    final serviceAsync = slug.isNotEmpty
        ? ref.watch(serviceDetailBySlugProvider(slug))
        : null;

    final service = serviceAsync?.valueOrNull ?? widget.initialService;

    if (service == null) {
      if (serviceAsync?.isLoading ?? true) {
        return const Scaffold(
          backgroundColor: AppColors.surface,
          appBar: ServiceDetailAppBar(),
          body: Center(
            child: CircularProgressIndicator(color: AppColors.primaryContainer),
          ),
        );
      }

      return Scaffold(
        backgroundColor: AppColors.surface,
        appBar: const ServiceDetailAppBar(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.info_outline,
                  size: 48,
                  color: AppColors.outline,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Dịch vụ hiện không khả dụng hoặc đã bị gỡ',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => context.pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryContainer,
                    foregroundColor: AppColors.onPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
                  ),
                  child: const Text('Quay lại'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final addresses = ref.watch(addressNotifierProvider).valueOrNull;
    final defaultAddress = (addresses != null && addresses.isNotEmpty)
        ? addresses.firstWhere(
            (a) => a.isDefault,
            orElse: () => addresses.first,
          )
        : null;
    final location = ref.watch(userLocationProvider);
    final hasValidGps =
        location.isLoaded &&
        location.hasPermission &&
        location.serviceEnabled &&
        location.error == null;
    final selectedAddressId = hasValidGps ? null : defaultAddress?.id;

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: ServiceDetailAppBar(shareTitle: service.name, serviceSlug: slug),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Banner Hero ảnh dịch vụ, badge "Phổ biến nhất" & thời lượng
            ServiceDetailHero(
              imageUrl: service.coverImageUrl,
              durationMinutes: service.defaultDurationMinutes,
            ),
            const SizedBox(height: 12),

            // 2. Thẻ Thông tin Dịch Vụ Chính (Giá, Tiệt trùng Y tế, Đánh giá) & Thẻ Mô Tả
            ServiceDetailOverviewCard(
              title: service.name,
              description: service.description,
              minPriceAmount: service.minPriceAmount,
              rating: service.rating,
              reviewCount: service.reviewCount,
            ),
            const SizedBox(height: 16),

            // 3. Quy trình thực hiện chuẩn 4 bước an tâm tại nhà
            const ServiceDetailProcessSteps(),
            const SizedBox(height: 16),

            // 4. Chuyên viên thực hiện dịch vụ gần bạn (hiển thị tối đa 5 + Xem tất cả)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: NearbyProvidersSection(
                serviceId: service.id,
                categorySlug: service.category.slug,
                customerAddressId: selectedAddressId,
                maxItems: 5,
                showViewAll: true,
              ),
            ),

            // 5. Đánh giá từ khách hàng (đặt bên dưới chuyên viên gần bạn, tối đa 5 + Xem tất cả)
            if (service.reviews.isNotEmpty) ...[
              const SizedBox(height: 16),
              _ServiceReviewsPreview(
                serviceSlug: slug,
                rating: service.rating,
                reviewCount: service.reviewCount,
                reviews: service.reviews,
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: ServiceDetailBottomBar(
        onSelectService: () => _handleSelectService(service),
        buttonText: 'Đặt lịch ngay',
      ),
    );
  }

  void _handleSelectService(ServiceItemEntity service) {
    ref.read(selectedServicesProvider.notifier).select(service);
    context.push('/booking/config', extra: service);
  }
}

class _ServiceReviewsPreview extends StatelessWidget {
  final String serviceSlug;
  final double? rating;
  final int reviewCount;
  final List<PublicReviewItemEntity> reviews;

  const _ServiceReviewsPreview({
    required this.serviceSlug,
    required this.rating,
    required this.reviewCount,
    required this.reviews,
  });

  void _openAllReviewsSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _AllServiceReviewsSheet(
        serviceSlug: serviceSlug,
        rating: rating,
        initialReviewCount: reviewCount > reviews.length
            ? reviewCount
            : reviews.length,
        initialReviews: reviews,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final visibleReviews = reviews.take(5).toList();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Đánh giá từ khách hàng',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: AppColors.onSurface,
                  ),
                ),
              ),
              TextButton(
                onPressed: () => _openAllReviewsSheet(context),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: const Text(
                  'Xem tất cả',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ...visibleReviews.map((review) => _ServiceReviewCard(review: review)),
        ],
      ),
    );
  }
}

class _ServiceReviewCard extends StatelessWidget {
  final PublicReviewItemEntity review;

  const _ServiceReviewCard({required this.review});

  @override
  Widget build(BuildContext context) {
    final comment = review.comment.toString().trim();
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.outlineVariant.withValues(alpha: 0.25),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  review.customerName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  5,
                  (i) => Icon(
                    i < review.rating
                        ? Icons.star_rounded
                        : Icons.star_outline_rounded,
                    size: 14,
                    color: AppColors.secondary,
                  ),
                ),
              ),
            ],
          ),
          if (comment.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              comment,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.onSurfaceVariant,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AllServiceReviewsSheet extends ConsumerStatefulWidget {
  final String serviceSlug;
  final double? rating;
  final int initialReviewCount;
  final List<PublicReviewItemEntity> initialReviews;

  const _AllServiceReviewsSheet({
    required this.serviceSlug,
    required this.rating,
    required this.initialReviewCount,
    required this.initialReviews,
  });

  @override
  ConsumerState<_AllServiceReviewsSheet> createState() =>
      _AllServiceReviewsSheetState();
}

class _AllServiceReviewsSheetState
    extends ConsumerState<_AllServiceReviewsSheet> {
  late List<PublicReviewItemEntity> _reviews;
  late int _totalCount;
  double? _averageRating;
  String? _nextCursor;
  bool _loading = false;
  bool _initializedFromApi = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _reviews = List<PublicReviewItemEntity>.from(widget.initialReviews);
    _totalCount = widget.initialReviewCount;
    _averageRating = widget.rating;
    if (_totalCount > _reviews.length && widget.serviceSlug.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _loadInitialPage());
    }
  }

  Future<void> _loadInitialPage() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref
          .read(catalogRepositoryProvider)
          .getServiceReviews(widget.serviceSlug, limit: 20);
      if (!mounted) return;
      setState(() {
        _reviews = page.reviews;
        _totalCount = page.count > page.reviews.length
            ? page.count
            : page.reviews.length;
        _averageRating = page.averageRating ?? _averageRating;
        _nextCursor = page.nextCursor;
        _initializedFromApi = true;
      });
    } on DioException {
      if (!mounted) return;
      setState(() => _error = 'Chưa tải được toàn bộ đánh giá.');
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is AppFailure
            ? e.message
            : 'Chưa tải được toàn bộ đánh giá.';
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_loading || _nextCursor == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await ref
          .read(catalogRepositoryProvider)
          .getServiceReviews(
            widget.serviceSlug,
            cursor: _nextCursor,
            limit: 20,
          );
      if (!mounted) return;
      final existing = _reviews.map((e) => e.id).toSet();
      final appended = page.reviews.where((r) => !existing.contains(r.id));
      setState(() {
        _reviews = [..._reviews, ...appended];
        _nextCursor = page.nextCursor;
      });
    } catch (_) {
      if (mounted) setState(() => _error = 'Chưa tải thêm được đánh giá.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final headerRating = _averageRating != null
        ? ' · ${_averageRating!.toStringAsFixed(1)}★'
        : '';
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.72,
      minChildSize: 0.45,
      maxChildSize: 0.92,
      builder: (_, scrollController) => Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.outlineVariant,
              borderRadius: BorderRadius.circular(100),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Đánh giá từ khách hàng ($_totalCount$headerRating)',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.onSurface,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (_loading && !_initializedFromApi) const LinearProgressIndicator(),
          Expanded(
            child: ListView(
              controller: scrollController,
              padding: const EdgeInsets.all(16),
              children: [
                ..._reviews.map((r) => _ServiceReviewCard(review: r)),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Column(
                      children: [
                        Text(
                          _error!,
                          style: const TextStyle(
                            color: AppColors.error,
                            fontSize: 12.5,
                          ),
                        ),
                        TextButton(
                          onPressed: _initializedFromApi
                              ? _loadMore
                              : _loadInitialPage,
                          child: const Text('Thử lại'),
                        ),
                      ],
                    ),
                  ),
                if (_nextCursor != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: OutlinedButton(
                      onPressed: _loading ? null : _loadMore,
                      child: Text(
                        _loading ? 'Đang tải...' : 'Tải thêm đánh giá',
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

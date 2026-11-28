import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_specialist_card.dart';
import 'package:mobile/features/customer/booking/domain/entities/booking_provider_candidate_entity.dart';

import '../data/provider_discovery_repository.dart';
import '../domain/provider_search_request.dart';

/// Browsing only: final availability and price are rechecked in booking/quote.
class NearbyProvidersSection extends ConsumerStatefulWidget {
  final String? customerAddressId;
  final String? categorySlug;
  final String? serviceId;
  final int radiusKm;
  final double? minRating;
  final String? title;
  final int? maxItems;
  final bool showViewAll;

  const NearbyProvidersSection({
    super.key,
    this.customerAddressId,
    this.categorySlug,
    this.serviceId,
    this.radiusKm = 30,
    this.minRating,
    this.title,
    this.maxItems,
    this.showViewAll = false,
  });

  @override
  ConsumerState<NearbyProvidersSection> createState() =>
      _NearbyProvidersSectionState();
}

class _NearbyProvidersSectionState
    extends ConsumerState<NearbyProvidersSection> {
  bool _locating = false;

  Future<void> _locate() async {
    setState(() => _locating = true);
    try {
      await ref.read(userLocationProvider.notifier).fetchLocation();
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final location = ref.watch(userLocationProvider);
    final selectedServiceId = widget.serviceId;
    final asyncRows = _needsLocationPrompt(location)
        ? null
        : selectedServiceId != null
        ? ref.watch(
            nearbyProvidersProvider(
              ProviderSearchRequest(
                serviceId: selectedServiceId,
                customerAddressId: widget.customerAddressId,
                latitude: location.latitude,
                longitude: location.longitude,
                radiusKm: widget.radiusKm,
              ),
            ),
          )
        : ref.watch(
            nearbyHomeProvidersProvider(
              NearbyHomeRequest(
                customerAddressId: widget.customerAddressId,
                latitude: location.latitude,
                longitude: location.longitude,
                radiusKm: widget.radiusKm,
                limit: 10,
              ),
            ),
          );
    final filteredAll = asyncRows?.valueOrNull == null
        ? const <BookingProviderCandidateEntity>[]
        : _filterRows(asyncRows!.valueOrNull!);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                widget.title ?? 'Chuyên viên đang hoạt động gần bạn',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: AppColors.onSurface,
                ),
              ),
            ),
            if (widget.showViewAll && filteredAll.isNotEmpty)
              TextButton(
                onPressed: () => _openAllSpecialistsSheet(context, filteredAll),
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
        const SizedBox(height: 12),
        if (_needsLocationPrompt(location))
          _message(
            _locationMessage(location),
            _locating ? null : _locate,
            _locating ? 'Đang định vị...' : 'Lấy vị trí hiện tại',
          )
        else if (selectedServiceId != null)
          _buildServiceResults(location, selectedServiceId)
        else
          _buildHomeNearbyResults(location),
      ],
    );
  }

  List<BookingProviderCandidateEntity> _filterRows(
    List<BookingProviderCandidateEntity> rows,
  ) {
    return rows
        .where(
          (p) =>
              widget.minRating == null ||
              (p.rating != null && p.rating! >= widget.minRating!),
        )
        .toList();
  }

  Widget _buildSpecialistCard(
    BuildContext context,
    BookingProviderCandidateEntity p, {
    VoidCallback? beforeNavigate,
  }) {
    final distanceKm = p.estimatedTravelDistanceKm ?? p.distanceKm;
    void openProfile() {
      beforeNavigate?.call();
      this.context.push('/providers/${p.id}/public');
    }

    return AppSpecialistCard(
      key: ValueKey('${p.id}:${p.memberId ?? ''}'),
      id: p.id,
      name: p.displayName,
      specialty: p.experienceYears > 0
          ? '${p.experienceYears} năm kinh nghiệm'
          : 'Chuyên viên làm đẹp',
      avatarUrl: p.avatarUrl ?? '',
      rating: p.rating,
      reviewCount: p.reviewCount,
      distance: '~${distanceKm.toStringAsFixed(1)} km',
      startingPrice: p.priceAmount,
      isOnline: p.available,
      actionText: 'Xem hồ sơ',
      margin: const EdgeInsets.only(bottom: 10),
      onBookTap: openProfile,
      onCardTap: openProfile,
    );
  }

  void _openAllSpecialistsSheet(
    BuildContext context,
    List<BookingProviderCandidateEntity> specialists,
  ) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => DraggableScrollableSheet(
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
                      'Chuyên viên gần bạn (${specialists.length})',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.onSurface,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(sheetContext).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                controller: scrollController,
                padding: const EdgeInsets.all(16),
                itemCount: specialists.length,
                itemBuilder: (_, index) => _buildSpecialistCard(
                  sheetContext,
                  specialists[index],
                  beforeNavigate: () => Navigator.of(sheetContext).pop(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildServiceResults(UserLocationModel location, String serviceId) {
    final request = ProviderSearchRequest(
      serviceId: serviceId,
      customerAddressId: widget.customerAddressId,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm: widget.radiusKm,
    );
    return _renderAsyncResults(
      ref.watch(nearbyProvidersProvider(request)),
      () => ref.invalidate(nearbyProvidersProvider(request)),
    );
  }

  Widget _buildHomeNearbyResults(UserLocationModel location) {
    final request = NearbyHomeRequest(
      customerAddressId: widget.customerAddressId,
      latitude: location.latitude,
      longitude: location.longitude,
      radiusKm: widget.radiusKm,
      limit: 10,
    );
    return _renderAsyncResults(
      ref.watch(nearbyHomeProvidersProvider(request)),
      () => ref.invalidate(nearbyHomeProvidersProvider(request)),
    );
  }

  bool _needsLocationPrompt(UserLocationModel location) {
    return widget.customerAddressId == null &&
        (!location.isLoaded ||
            !location.hasPermission ||
            !location.serviceEnabled ||
            location.error != null);
  }

  String _locationMessage(UserLocationModel location) {
    if (!location.isLoaded) {
      return 'Lấy vị trí hiện tại để tìm chuyên viên gần bạn.';
    }
    if (!location.serviceEnabled) return 'Hãy bật GPS để tìm chuyên viên.';
    if (!location.hasPermission) {
      return 'Hãy cấp quyền vị trí trong cài đặt hoặc chọn địa chỉ đã lưu.';
    }
    return 'Chưa lấy được vị trí. Vui lòng thử lại hoặc chọn địa chỉ đã lưu.';
  }

  Widget _renderAsyncResults(
    AsyncValue<List<BookingProviderCandidateEntity>> asyncRows,
    VoidCallback onRetry,
  ) {
    return asyncRows.when(
      loading: () => const LinearProgressIndicator(),
      error: (error, _) => _message(
        error is AppFailure
            ? error.message
            : 'Chưa tìm được chuyên viên. Vui lòng thử lại.',
        onRetry,
        'Thử lại',
      ),
      data: (rows) {
        final filtered = _filterRows(rows);
        if (filtered.isEmpty) {
          return const Text(
            'Chưa có chuyên viên phù hợp đang hoạt động. Bạn có thể đặt lịch trước.',
          );
        }
        final visible = widget.maxItems != null
            ? filtered.take(widget.maxItems!).toList()
            : filtered;
        return Column(
          children: visible
              .map((p) => _buildSpecialistCard(context, p))
              .toList(),
        );
      },
    );
  }

  Widget _message(String message, VoidCallback? action, String label) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(message),
      TextButton(onPressed: action, child: Text(label)),
    ],
  );
}

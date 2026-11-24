import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/core/widgets/app_specialist_card.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/services_list_provider.dart';

import '../data/provider_discovery_repository.dart';
import '../domain/provider_search_request.dart';

/// Browsing only: final availability and price are rechecked in booking/quote.
class NearbyProvidersSection extends ConsumerStatefulWidget {
  final String? customerAddressId;
  final String? categorySlug;
  final int radiusKm;
  final double? minRating;
  const NearbyProvidersSection({
    super.key,
    this.customerAddressId,
    this.categorySlug,
    this.radiusKm = 30,
    this.minRating,
  });

  @override
  ConsumerState<NearbyProvidersSection> createState() =>
      _NearbyProvidersSectionState();
}

class _NearbyProvidersSectionState
    extends ConsumerState<NearbyProvidersSection> {
  String? _serviceId;
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
    final catalog = ref.watch(allCatalogServicesProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Chuyên viên đang hoạt động gần bạn',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        catalog.when(
          loading: () => const LinearProgressIndicator(),
          error: (_, __) => _message(
            'Chưa tải được dịch vụ.',
            () => ref.invalidate(allCatalogServicesProvider),
            'Thử lại',
          ),
          data: (services) {
            final choices = services
                .where(
                  (s) =>
                      widget.categorySlug == null ||
                      s.category.slug == widget.categorySlug,
                )
                .toList();
            if (choices.isEmpty) {
              return const Text('Chưa có dịch vụ trong danh mục này.');
            }
            final selected = choices.any((s) => s.id == _serviceId)
                ? _serviceId
                : null;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButtonFormField<String>(
                  key: ValueKey(selected),
                  initialValue: selected,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Dịch vụ muốn tìm chuyên viên',
                  ),
                  items: choices
                      .map(
                        (s) => DropdownMenuItem(
                          value: s.id,
                          child: Text(s.name, overflow: TextOverflow.ellipsis),
                        ),
                      )
                      .toList(),
                  onChanged: (id) => setState(() => _serviceId = id),
                ),
                const SizedBox(height: 8),
                if (selected == null)
                  const Text('Chọn một dịch vụ để xem chuyên viên phù hợp.')
                else if (widget.customerAddressId == null &&
                    (!location.isLoaded ||
                        !location.hasPermission ||
                        !location.serviceEnabled ||
                        location.error != null))
                  _message(
                    _locationMessage(location),
                    _locating ? null : _locate,
                    _locating ? 'Đang định vị...' : 'Lấy vị trí hiện tại',
                  )
                else
                  _results(
                    ProviderSearchRequest(
                      serviceId: selected,
                      customerAddressId: widget.customerAddressId,
                      latitude: location.latitude,
                      longitude: location.longitude,
                      radiusKm: widget.radiusKm,
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
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

  Widget _results(ProviderSearchRequest request) {
    return ref
        .watch(nearbyProvidersProvider(request))
        .when(
          loading: () => const LinearProgressIndicator(),
          error: (error, _) => _message(
            error is AppFailure
                ? error.message
                : 'Chưa tìm được chuyên viên. Vui lòng thử lại.',
            () => ref.invalidate(nearbyProvidersProvider(request)),
            'Thử lại',
          ),
          data: (rows) {
            final available = rows
                .where(
                  (p) =>
                      p.available &&
                      (widget.minRating == null ||
                          (p.rating != null && p.rating! >= widget.minRating!)),
                )
                .toList();
            if (available.isEmpty) {
              return const Text(
                'Chưa có chuyên viên phù hợp đang hoạt động. Bạn có thể đặt lịch trước.',
              );
            }
            return Column(
              children: available
                  .map(
                    (p) => AppSpecialistCard(
                      key: ValueKey('${p.id}:${p.memberId ?? ''}'),
                      id: p.id,
                      name: p.displayName,
                      specialty: 'Dịch vụ đã chọn',
                      avatarUrl: p.avatarUrl ?? '',
                      rating: p.rating,
                      reviewCount: p.reviewCount,
                      distance:
                          '${p.distanceKm.toStringAsFixed(1)} km (đường thẳng)',
                      startingPrice: p.priceAmount,
                      isOnline: true,
                      actionText: 'Xem hồ sơ',
                      onBookTap: () =>
                          context.push('/providers/${p.id}/public'),
                      onCardTap: () =>
                          context.push('/providers/${p.id}/public'),
                    ),
                  )
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/address/di/address_providers.dart';

class HomeLocationSelectorSheet extends ConsumerWidget {
  final String? selectedLocationMode;
  final ValueChanged<String?> onModeChanged;

  const HomeLocationSelectorSheet({
    super.key,
    required this.selectedLocationMode,
    required this.onModeChanged,
  });

  static Future<void> show(
    BuildContext context, {
    required String? selectedLocationMode,
    required ValueChanged<String?> onModeChanged,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => HomeLocationSelectorSheet(
        selectedLocationMode: selectedLocationMode,
        onModeChanged: onModeChanged,
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final liveLocation = ref.watch(userLocationProvider);
    final liveAddresses = ref.watch(addressNotifierProvider).valueOrNull ?? [];
    // Luôn ưu tiên mặc định là GPS / Vị trí hiện tại
    final isGpsActive = selectedLocationMode == null || selectedLocationMode == 'GPS';

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Địa chỉ nhận dịch vụ',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.onSurface,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Lựa chọn 1: Vị trí GPS hiện tại
          InkWell(
            onTap: () {
              onModeChanged('GPS');
              Navigator.pop(context);
            },
            borderRadius: BorderRadius.circular(14),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isGpsActive
                    ? AppColors.primaryContainer.withValues(alpha: 0.2)
                    : AppColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isGpsActive
                      ? AppColors.primary
                      : AppColors.outlineVariant.withValues(alpha: 0.5),
                  width: isGpsActive ? 1.5 : 1.0,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.near_me_rounded,
                      color: AppColors.primary,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Text(
                              'Vị trí GPS hiện tại',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: AppColors.onSurface,
                              ),
                            ),
                            if (isGpsActive) ...[
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 1.5,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.primary,
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: const Text(
                                  'Đang dùng',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          liveLocation.isLoaded
                              ? (liveLocation.addressLine.isNotEmpty
                                    ? liveLocation.addressLine
                                    : 'Chưa xác định tọa độ')
                              : 'Đang định vị GPS...',
                          style: TextStyle(
                            color: Colors.grey.shade600,
                            fontSize: 12.5,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.refresh_rounded, size: 20),
                    tooltip: 'Làm mới GPS',
                    color: AppColors.primary,
                    onPressed: () {
                      ref.read(userLocationProvider.notifier).fetchLocation();
                    },
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Lựa chọn 2: Danh sách địa chỉ đã lưu trong sổ
          if (liveAddresses.isNotEmpty) ...[
            const Text(
              'Địa chỉ đã lưu trong sổ',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 8),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: liveAddresses.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (ctx, idx) {
                  final addr = liveAddresses[idx];
                  final isSelected = !isGpsActive && (selectedLocationMode == addr.id || (selectedLocationMode == null && addr.isDefault));

                  return InkWell(
                    onTap: () {
                      onModeChanged(addr.id);
                      Navigator.pop(context);
                    },
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? AppColors.primaryContainer.withValues(alpha: 0.15)
                            : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.outlineVariant.withValues(alpha: 0.5),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            addr.type == 'HOME'
                                ? Icons.home_rounded
                                : (addr.type == 'WORK'
                                      ? Icons.business_rounded
                                      : Icons.location_on_rounded),
                            color: isSelected ? AppColors.primary : Colors.grey,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  addr.label ?? 'Địa chỉ',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13.5,
                                    color: isSelected
                                        ? AppColors.primary
                                        : AppColors.onSurface,
                                  ),
                                ),
                                Text(
                                  addr.addressLine,
                                  style: TextStyle(
                                    color: Colors.grey.shade600,
                                    fontSize: 12,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          if (isSelected)
                            const Icon(
                              Icons.check_circle_rounded,
                              color: AppColors.primary,
                              size: 18,
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Nút chuyển đến quản lý sổ địa chỉ
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                context.push('/profile/address');
              },
              icon: const Icon(Icons.manage_accounts_outlined, size: 18),
              label: const Text('Quản lý sổ địa chỉ'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

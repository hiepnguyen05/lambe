import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/guidance/presentation/guidance_trigger.dart';

import '../../di/provider_workspace_providers.dart';

class OnlineStatusCard extends ConsumerWidget {
  const OnlineStatusCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final isOnline = ref.watch(
      providerDashboardProvider.select(
        (state) => state.value?.isOnline ?? false,
      ),
    );
    final verified = ref.watch(
      providerDashboardProvider.select(
        (s) => s.valueOrNull?.availabilityVerified == true,
      ),
    );
    final busy = ref.watch(
      providerDashboardProvider.select(
        (s) => s.valueOrNull?.isUpdating == true,
      ),
    );

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surface, // map to surface-container-lowest
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: colorScheme.outlineVariant.withValues(alpha: 0.5),
        ),
        boxShadow: [
          BoxShadow(
            color: colorScheme.primaryContainer.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Row(
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: isOnline && verified
                        ? Colors.green.shade500
                        : colorScheme.outline,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: isOnline && verified
                          ? Colors.green.shade100
                          : Colors.grey.shade100,
                      width: 4,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        !verified
                            ? 'Chưa xác minh hoạt động'
                            : isOnline
                            ? 'Đang hoạt động'
                            : 'Đang tắt nhận khách',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      Text(
                        !verified
                            ? 'Tải lại để kiểm tra trạng thái server'
                            : isOnline
                            ? 'Sẵn sàng nhận khách mới'
                            : 'Tạm dừng phân bổ đơn mới',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (!verified)
            IconButton(
              tooltip: 'Kiểm tra trạng thái nhận đơn',
              icon: const Icon(Icons.refresh),
              onPressed: busy
                  ? null
                  : () => ref
                        .read(providerDashboardProvider.notifier)
                        .refreshAvailability(),
            ),
          GuidanceAnchor(
            id: 'provider_online',
            child: Switch(
              value: isOnline,
              onChanged: !verified || busy
                  ? null
                  : (value) async {
                      if (value) {
                        var hasPermission = false;
                        try {
                          final permission = await Geolocator.checkPermission();
                          hasPermission =
                              permission == LocationPermission.always ||
                              permission == LocationPermission.whileInUse;
                        } catch (error) {
                          debugPrint(
                            '[OnlineStatusCard] Location permission check failed: $error',
                          );
                        }
                        if (!hasPermission && context.mounted) {
                          final allowed = await showDialog<bool>(
                            context: context,
                            builder: (dialogContext) => AlertDialog(
                              title: const Text('Bật nhận đơn gần bạn?'),
                              content: const Text(
                                'Lambe dùng vị trí để tìm khách gần bạn khi bạn bật nhận đơn. '
                                'Trên Android, vị trí tiếp tục được cập nhật khi bạn chuyển sang ứng dụng khác '
                                'và có thông báo thường trực. Bạn có thể tắt nhận đơn bất kỳ lúc nào. '
                                'Nếu đóng hẳn ứng dụng, trạng thái online sẽ hết hạn khi không còn cập nhật vị trí.',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () =>
                                      Navigator.pop(dialogContext, false),
                                  child: const Text('Để sau'),
                                ),
                                FilledButton(
                                  onPressed: () =>
                                      Navigator.pop(dialogContext, true),
                                  child: const Text('Tiếp tục'),
                                ),
                              ],
                            ),
                          );
                          if (allowed != true || !context.mounted) return;
                        }
                      }
                      final error = await ref
                          .read(providerDashboardProvider.notifier)
                          .toggleOnlineStatus(value);
                      if (error != null && context.mounted) {
                        AppDialog.error(context, message: error);
                      }
                    },
              activeThumbColor: colorScheme.onPrimary,
              activeTrackColor: colorScheme.primary,
              inactiveThumbColor: colorScheme.outline,
              inactiveTrackColor: colorScheme.outlineVariant,
            ),
          ),
        ],
      ),
    );
  }
}

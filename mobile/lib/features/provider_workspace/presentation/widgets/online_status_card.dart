import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../di/provider_workspace_providers.dart';

class OnlineStatusCard extends ConsumerWidget {
  const OnlineStatusCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    
    final isOnline = ref.watch(providerDashboardProvider.select(
      (state) => state.value?.isOnline ?? false,
    ));

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
          Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: 14,
                height: 14,
                decoration: BoxDecoration(
                  color: isOnline ? Colors.green.shade500 : colorScheme.outline,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isOnline ? Colors.green.shade100 : Colors.grey.shade100,
                    width: 4,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isOnline ? 'Đang hoạt động' : 'Đang tắt nhận khách',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  Text(
                    isOnline ? 'Sẵn sàng nhận khách mới' : 'Tạm dừng phân bổ đơn mới',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ],
          ),
          Switch(
            value: isOnline,
            onChanged: (value) async {
              final error = await ref.read(providerDashboardProvider.notifier).toggleOnlineStatus(value);
              if (error != null && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(error),
                    backgroundColor: Theme.of(context).colorScheme.error,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              }
            },
            activeThumbColor: colorScheme.onPrimary,
            activeTrackColor: colorScheme.primary,
            inactiveThumbColor: colorScheme.outline,
            inactiveTrackColor: colorScheme.outlineVariant,
          ),
        ],
      ),
    );
  }
}

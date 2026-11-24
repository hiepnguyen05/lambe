import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/core/location/user_location_provider.dart';

import '../../di/provider_workspace_providers.dart';

class ProviderMainScreen extends ConsumerStatefulWidget {
  final StatefulNavigationShell navigationShell;

  const ProviderMainScreen({super.key, required this.navigationShell});

  @override
  ConsumerState<ProviderMainScreen> createState() => _ProviderMainScreenState();
}

class _ProviderMainScreenState extends ConsumerState<ProviderMainScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(userLocationProvider.notifier).stopPositionStream();
      }
    });
  }

  void _onTap(int index) {
    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(resumeProviderTrackingProvider);
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      body: widget.navigationShell,
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: colorScheme.surface.withAlpha(
            240,
          ), // withOpacity -> withAlpha(240)
          border: Border(
            top: BorderSide(
              color: colorScheme.surfaceContainerHighest.withAlpha(150),
              width: 1,
            ),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(12),
              blurRadius: 24,
              offset: const Offset(0, -4),
            ),
          ],
        ),
        child: SafeArea(
          child: SizedBox(
            height: 64,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(
                  context: context,
                  index: 0,
                  icon: Icons.home_outlined,
                  activeIcon: Icons.home,
                  label: 'Trang chủ',
                ),
                _buildNavItem(
                  context: context,
                  index: 1,
                  icon: Icons.calendar_month_outlined,
                  activeIcon: Icons.calendar_month,
                  label: 'Đơn đặt',
                ),
                _buildNavItem(
                  context: context,
                  index: 2,
                  icon: Icons.explore_outlined,
                  activeIcon: Icons.explore,
                  label: 'Khám phá',
                ),
                _buildNavItem(
                  context: context,
                  index: 3,
                  icon: Icons.account_balance_wallet_outlined,
                  activeIcon: Icons.account_balance_wallet,
                  label: 'Thu nhập',
                ),
                _buildNavItem(
                  context: context,
                  index: 4,
                  icon: Icons.star_outline_rounded,
                  activeIcon: Icons.star_rounded,
                  label: 'Đánh giá',
                ),
                _buildNavItem(
                  context: context,
                  index: 5,
                  icon: Icons.person_outline,
                  activeIcon: Icons.person,
                  label: 'Tài khoản',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required BuildContext context,
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
  }) {
    final isActive = widget.navigationShell.currentIndex == index;
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final color = isActive ? colorScheme.primary : colorScheme.onSurfaceVariant;
    final fontWeight = isActive ? FontWeight.bold : FontWeight.normal;

    return Expanded(
      child: InkWell(
        onTap: () => _onTap(index),
        splashColor: Colors.transparent,
        highlightColor: Colors.transparent,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(isActive ? activeIcon : icon, color: color, size: 22),
            const SizedBox(height: 2),
            Text(
              label,
              style: theme.textTheme.labelSmall?.copyWith(
                fontSize: 10.5,
                fontWeight: fontWeight,
                color: color,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

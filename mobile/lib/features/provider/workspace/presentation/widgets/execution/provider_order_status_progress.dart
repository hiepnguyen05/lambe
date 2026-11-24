import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class ProviderOrderStatusProgress extends StatelessWidget {
  final String status;

  const ProviderOrderStatusProgress({super.key, required this.status});

  static const _steps = [
    (
      status: 'ACCEPTED',
      label: 'Đã nhận',
      icon: Icons.assignment_turned_in_outlined,
    ),
    (status: 'EN_ROUTE', label: 'Di chuyển', icon: Icons.directions_outlined),
    (status: 'ARRIVED', label: 'Đã đến', icon: Icons.location_on_outlined),
    (
      status: 'IN_PROGRESS',
      label: 'Thực hiện',
      icon: Icons.play_circle_outline_rounded,
    ),
    (status: 'COMPLETED', label: 'Hoàn tất', icon: Icons.check_rounded),
  ];

  int get _currentIndex => _steps.indexWhere((step) => step.status == status);

  @override
  Widget build(BuildContext context) {
    if (status == 'PENDING_PROVIDER' || _currentIndex < 0) {
      return const SizedBox.shrink();
    }

    return Material(
      color: Colors.white,
      child: SafeArea(
        top: false,
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 9, 12, 10),
          child: Row(
            children: [
              for (var index = 0; index < _steps.length; index++) ...[
                Expanded(
                  child: _StatusStep(
                    label: _steps[index].label,
                    icon: _steps[index].icon,
                    isDone: index < _currentIndex,
                    isCurrent: index == _currentIndex,
                  ),
                ),
                if (index < _steps.length - 1)
                  Container(
                    width: 10,
                    height: 2,
                    margin: const EdgeInsets.only(bottom: 16),
                    color: index < _currentIndex
                        ? AppColors.primary
                        : const Color(0xFFDCE5E3),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusStep extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isDone;
  final bool isCurrent;

  const _StatusStep({
    required this.label,
    required this.icon,
    required this.isDone,
    required this.isCurrent,
  });

  @override
  Widget build(BuildContext context) {
    final active = isDone || isCurrent;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: isCurrent
                ? AppColors.primary
                : isDone
                ? const Color(0xFFE4F2EF)
                : const Color(0xFFF1F5F4),
            shape: BoxShape.circle,
          ),
          child: Icon(
            isDone ? Icons.check_rounded : icon,
            size: 15,
            color: isCurrent
                ? Colors.white
                : active
                ? AppColors.primary
                : const Color(0xFF87928F),
          ),
        ),
        const SizedBox(height: 3),
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            label,
            maxLines: 1,
            style: TextStyle(
              fontSize: 10,
              fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
              color: active ? AppColors.onSurface : AppColors.onSurfaceVariant,
            ),
          ),
        ),
      ],
    );
  }
}

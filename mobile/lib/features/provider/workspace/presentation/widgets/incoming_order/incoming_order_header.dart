import 'package:flutter/material.dart';

class IncomingOrderHeader extends StatelessWidget {
  final bool isAsap;
  final int remainingSeconds;
  final int totalSeconds;

  const IncomingOrderHeader({
    super.key,
    required this.isAsap,
    required this.remainingSeconds,
    required this.totalSeconds,
  });

  @override
  Widget build(BuildContext context) {
    final progress = totalSeconds > 0
        ? (remainingSeconds / totalSeconds).clamp(0.0, 1.0)
        : 0.0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Row tag đơn gấp & timer đếm ngược
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Tag loại đơn
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 10,
                vertical: 4.5,
              ),
              decoration: BoxDecoration(
                color: isAsap
                    ? const Color(0xFFFEF3C7)
                    : const Color(0xFFEFF6F5),
                borderRadius: BorderRadius.circular(100),
                border: Border.all(
                  color: isAsap
                      ? const Color(0xFFFDE68A)
                      : const Color(0xFFCCFBF1),
                  width: 1,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    isAsap ? Icons.bolt_rounded : Icons.calendar_month_rounded,
                    size: 15,
                    color: isAsap
                        ? const Color(0xFFB45309)
                        : const Color(0xFF0F766E),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    isAsap ? 'ĐƠN LÀM NGAY (CẦN GẤP)' : 'ĐƠN ĐẶT HẸN GIỜ',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: isAsap
                          ? const Color(0xFF92400E)
                          : const Color(0xFF0F766E),
                      letterSpacing: 0.2,
                    ),
                  ),
                ],
              ),
            ),

            // Badge thời gian đếm ngược
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 10,
                vertical: 4.5,
              ),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(100),
                border: Border.all(color: const Color(0xFFFDE68A), width: 1),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.08),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.timer_rounded,
                    size: 15,
                    color: Color(0xFFD97706),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${remainingSeconds}s',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF92400E),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),

        const SizedBox(height: 10),

        // Thanh tiến trình đếm ngược màu gradient
        ClipRRect(
          borderRadius: BorderRadius.circular(100),
          child: Container(
            height: 6,
            width: double.infinity,
            color: const Color(0xFFF1F5F9),
            alignment: Alignment.centerLeft,
            child: FractionallySizedBox(
              widthFactor: progress,
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF0F766E), Color(0xFFF59E0B)],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

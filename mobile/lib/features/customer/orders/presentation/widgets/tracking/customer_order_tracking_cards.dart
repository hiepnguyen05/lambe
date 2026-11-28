import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/utils/currency_utils.dart';
import 'package:mobile/features/shared/tracking/domain/order_tracking_snapshot.dart';

import '../../../domain/entities/customer_order_entity.dart';

class CustomerOrderTrackingStepper extends StatelessWidget {
  final CustomerOrderEntity order;

  const CustomerOrderTrackingStepper({super.key, required this.order});

  @override
  Widget build(BuildContext context) {
    const steps = ['Đã nhận', 'Di chuyển', 'Đã đến', 'Thực hiện', 'Hoàn tất'];

    int currentIdx = 0;
    if (order.isAccepted) currentIdx = 0;
    if (order.isEnRoute) currentIdx = 1;
    if (order.isArrived) currentIdx = 2;
    if (order.isInProgress) currentIdx = 3;
    if (order.isCompleted) currentIdx = 4;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      decoration: const BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        border: Border(
          bottom: BorderSide(color: Color(0xFFE2E8F0)),
        ),
      ),
      child: Row(
        children: List.generate(steps.length, (index) {
          final isDone = index < currentIdx || order.isCompleted;
          final isCurrent = index == currentIdx && !order.isCompleted;

          return Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 2.5,
                        color: index == 0
                            ? Colors.transparent
                            : (isDone || isCurrent
                                ? AppColors.primary
                                : const Color(0xFFE2E8F0)),
                      ),
                    ),
                    _StepNode(isDone: isDone, isCurrent: isCurrent),
                    Expanded(
                      child: Container(
                        height: 2.5,
                        color: index == steps.length - 1
                            ? Colors.transparent
                            : (isDone
                                ? AppColors.primary
                                : const Color(0xFFE2E8F0)),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    steps[index],
                    maxLines: 1,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: isCurrent
                          ? FontWeight.w700
                          : (isDone ? FontWeight.w600 : FontWeight.w500),
                      color: isCurrent
                          ? AppColors.onBackground
                          : (isDone
                                ? AppColors.primary
                                : AppColors.textMuted),
                    ),
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}

class _StepNode extends StatelessWidget {
  final bool isDone;
  final bool isCurrent;

  const _StepNode({required this.isDone, required this.isCurrent});

  @override
  Widget build(BuildContext context) {
    if (isDone) {
      return Container(
        width: 24,
        height: 24,
        decoration: const BoxDecoration(
          color: Color(0xFFD1FAE5),
          shape: BoxShape.circle,
        ),
        child: const Icon(
          Icons.check_rounded,
          size: 14,
          color: AppColors.primary,
        ),
      );
    }
    if (isCurrent) {
      return Container(
        width: 26,
        height: 26,
        decoration: BoxDecoration(
          color: AppColors.primary,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.28),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: const Center(
          child: SizedBox(
            width: 8,
            height: 8,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
            ),
          ),
        ),
      );
    }
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
    );
  }
}

class CustomerOrderStatusHeroCard extends StatelessWidget {
  final CustomerOrderEntity order;
  final OrderTrackingSnapshot? tracking;
  final Duration remainingTime;

  const CustomerOrderStatusHeroCard({
    super.key,
    required this.order,
    this.tracking,
    required this.remainingTime,
  });

  @override
  Widget build(BuildContext context) {
    String title = 'Đang xử lý đơn hàng';
    String subtitle = 'Hệ thống đang cập nhật tiến trình phục vụ';
    IconData icon = Icons.info_outline_rounded;
    Color accent = AppColors.primary;
    Color badgeBg = const Color(0xFFF0FDFA);
    Widget? trailingChip;

    if (order.isPending) {
      final mm = remainingTime.inMinutes.toString().padLeft(2, '0');
      final ss = (remainingTime.inSeconds % 60).toString().padLeft(2, '0');
      title = 'Đang chờ chuyên viên xác nhận';
      subtitle = 'Chuyên viên sẽ phản hồi trong thời gian quy định';
      icon = Icons.hourglass_top_rounded;
      accent = const Color(0xFFD97706);
      badgeBg = const Color(0xFFFEF3C7);
      trailingChip = _StatusPill(
        text: '$mm:$ss',
        color: const Color(0xFFB45309),
        bg: const Color(0xFFFEF3C7),
      );
    } else if (order.isAccepted) {
      title = 'Chuyên viên đã nhận lịch';
      final when = order.expectedStartAt ?? order.scheduledAt;
      subtitle = when != null
          ? 'Dự kiến phục vụ lúc ${DateFormat('HH:mm · dd/MM').format(when.toLocal())}'
          : 'Chuyên viên đang chuẩn bị để xuất phát';
      icon = Icons.event_available_rounded;
      accent = AppColors.primary;
      badgeBg = const Color(0xFFCCFBF1);
    } else if (order.isEnRoute) {
      title = 'Chuyên viên đang trên đường đến';
      final fresh = tracking?.hasFreshPosition == true;
      final etaMinutes = fresh && tracking?.durationSeconds != null
          ? (tracking!.durationSeconds! / 60).ceil()
          : null;
      subtitle = !fresh
          ? 'Đang chờ tín hiệu vị trí trực tiếp từ chuyên viên'
          : etaMinutes == null
          ? 'Đang di chuyển đến địa chỉ của bạn'
          : 'Dự kiến đến trong khoảng $etaMinutes phút';
      icon = Icons.two_wheeler_rounded;
      accent = const Color(0xFF2563EB);
      badgeBg = const Color(0xFFDBEAFE);
      if (etaMinutes != null) {
        trailingChip = _StatusPill(
          text: '~$etaMinutes phút',
          color: const Color(0xFF1D4ED8),
          bg: const Color(0xFFDBEAFE),
        );
      }
    } else if (order.isArrived) {
      title = 'Chuyên viên đã đến nơi';
      subtitle = 'Vui lòng giữ liên lạc để đón chuyên viên vào phục vụ';
      icon = Icons.place_rounded;
      accent = const Color(0xFF7C3AED);
      badgeBg = const Color(0xFFEDE9FE);
    } else if (order.isInProgress) {
      if (order.isWorkPaused) {
        title = 'Dịch vụ đang tạm dừng';
        subtitle = 'Đồng hồ thực hiện đang tạm nghỉ theo yêu cầu';
        icon = Icons.pause_circle_filled_rounded;
        accent = const Color(0xFFD97706);
        badgeBg = const Color(0xFFFEF3C7);
      } else {
        title = 'Đang thực hiện dịch vụ';
        subtitle = order.startedAt != null
            ? 'Bắt đầu lúc ${DateFormat('HH:mm').format(order.startedAt!.toLocal())} · Dự kiến ${order.durationMinutes} phút'
            : 'Chuyên viên đang phục vụ đơn hàng của bạn';
        icon = Icons.content_cut_rounded;
        accent = AppColors.primary;
        badgeBg = const Color(0xFFD1FAE5);
      }
      if (order.startedAt != null) {
        trailingChip = _LiveWorkTimerChip(
          startedAt: order.startedAt!,
          workPausedAt: order.workPausedAt,
          totalPausedSeconds: order.totalPausedSeconds,
        );
      }
    } else if (order.isCompleted) {
      title = 'Dịch vụ đã hoàn tất';
      subtitle = 'Cảm ơn bạn đã tin tưởng sử dụng dịch vụ tại Lambe';
      icon = Icons.task_alt_rounded;
      accent = AppColors.activeEmerald;
      badgeBg = const Color(0xFFD1FAE5);
    } else if (order.isCancelled || order.isRejected || order.isExpired) {
      title = order.isRejected
          ? 'Chuyên viên chưa thể nhận đơn'
          : (order.isExpired ? 'Đơn đặt lịch đã hết hạn' : 'Đơn hàng đã hủy');
      subtitle = order.rejectionReason?.trim().isNotEmpty == true
          ? order.rejectionReason!.trim()
          : 'Bạn có thể đặt lịch lại bất cứ lúc nào';
      icon = Icons.cancel_outlined;
      accent = AppColors.error;
      badgeBg = const Color(0xFFFEE2E2);
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: badgeBg,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: accent, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onBackground,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.textMuted,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          if (trailingChip != null) ...[
            const SizedBox(width: 8),
            trailingChip,
          ],
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String text;
  final Color color;
  final Color bg;

  const _StatusPill({
    required this.text,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w800,
          color: color,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
      ),
    );
  }
}

class _LiveWorkTimerChip extends StatefulWidget {
  final DateTime startedAt;
  final DateTime? workPausedAt;
  final int totalPausedSeconds;

  const _LiveWorkTimerChip({
    required this.startedAt,
    required this.workPausedAt,
    required this.totalPausedSeconds,
  });

  @override
  State<_LiveWorkTimerChip> createState() => _LiveWorkTimerChipState();
}

class _LiveWorkTimerChipState extends State<_LiveWorkTimerChip> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _syncTicker();
  }

  @override
  void didUpdateWidget(covariant _LiveWorkTimerChip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.workPausedAt != widget.workPausedAt ||
        oldWidget.startedAt != widget.startedAt) {
      _syncTicker();
    }
  }

  void _syncTicker() {
    _timer?.cancel();
    if (widget.workPausedAt == null) {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formattedElapsed() {
    final now = widget.workPausedAt ?? DateTime.now();
    final elapsedSeconds =
        now.difference(widget.startedAt).inSeconds - widget.totalPausedSeconds;
    final clamped = elapsedSeconds < 0 ? 0 : elapsedSeconds;
    final hours = clamped ~/ 3600;
    final minutes = (clamped % 3600) ~/ 60;
    final seconds = clamped % 60;
    if (hours > 0) {
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final paused = widget.workPausedAt != null;
    return _StatusPill(
      text: paused ? 'Tạm dừng · ${_formattedElapsed()}' : _formattedElapsed(),
      color: paused ? const Color(0xFFB45309) : AppColors.primary,
      bg: paused ? const Color(0xFFFEF3C7) : const Color(0xFFCCFBF1),
    );
  }
}

class CustomerOrderServiceSummaryCard extends StatelessWidget {
  final CustomerOrderEntity order;

  const CustomerOrderServiceSummaryCard({super.key, required this.order});

  @override
  Widget build(BuildContext context) {
    final currency = CurrencyUtils.vndCurrency;
    final acceptedAddOns =
        order.addOnSnapshot?.items
            .where((item) => item.status == 'ACCEPTED')
            .toList() ??
        const [];
    final extraMinutes = acceptedAddOns.fold<int>(
      0,
      (sum, item) => sum + item.durationMinutes,
    );
    final totalDuration = order.durationMinutes + extraMinutes;
    final when = order.expectedStartAt ?? order.scheduledAt;
    final whenText = when != null
        ? DateFormat('HH:mm · dd/MM/yyyy').format(when.toLocal())
        : 'Đặt ngay';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Thông tin dịch vụ & thanh toán',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.onBackground,
            ),
          ),
          const SizedBox(height: 12),
          _InfoLine(
            icon: Icons.spa_outlined,
            label: order.serviceName,
            trailing: '$totalDuration phút',
          ),
          const SizedBox(height: 8),
          _InfoLine(
            icon: Icons.schedule_rounded,
            label: whenText,
          ),
          const SizedBox(height: 8),
          _InfoLine(
            icon: Icons.location_on_outlined,
            label: order.addressLine ?? 'Tại địa chỉ của bạn',
          ),
          if (order.customerNote?.trim().isNotEmpty == true) ...[
            const SizedBox(height: 8),
            _InfoLine(
              icon: Icons.notes_rounded,
              label: 'Ghi chú: ${order.customerNote!.trim()}',
            ),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: Color(0xFFE2E8F0)),
          ),
          _AmountRow(
            label: 'Giá dịch vụ',
            value: currency.format(order.servicePriceAmount),
          ),
          if (order.travelFeeAmount > 0) ...[
            const SizedBox(height: 6),
            _AmountRow(
              label: 'Phí di chuyển',
              value: currency.format(order.travelFeeAmount),
            ),
          ],
          for (final item in acceptedAddOns) ...[
            const SizedBox(height: 6),
            _AmountRow(
              label: '${item.serviceName} (phát sinh)',
              value: '+${currency.format(item.priceAmount)}',
              valueColor: AppColors.primary,
            ),
          ],
          if (order.discountAmount > 0) ...[
            const SizedBox(height: 6),
            _AmountRow(
              label: order.voucherCode != null
                  ? 'Voucher (${order.voucherCode})'
                  : 'Giảm giá voucher',
              value: '-${currency.format(order.discountAmount)}',
              valueColor: AppColors.activeEmerald,
            ),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Divider(height: 1, color: Color(0xFFE2E8F0)),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Tổng thanh toán',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.onBackground,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Thanh toán tiền mặt khi hoàn tất',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
              Text(
                currency.format(order.totalAmount),
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? trailing;

  const _InfoLine({
    required this.icon,
    required this.label,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1.5),
          child: Icon(icon, size: 16, color: AppColors.textMuted),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.onBackground,
              height: 1.35,
            ),
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              trailing!,
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: AppColors.onSurfaceVariant,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _AmountRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _AmountRow({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textMuted,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 12),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: valueColor ?? AppColors.onBackground,
          ),
        ),
      ],
    );
  }
}

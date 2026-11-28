import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';

/// Màn hình gộp chung cho trạng thái Đã đến (ARRIVED) và Đang thực hiện (IN_PROGRESS).
class ProviderOrderServiceTimerView extends StatefulWidget {
  final Map<String, dynamic> order;
  final VoidCallback? onFinishService;
  final VoidCallback? onTogglePause;
  final VoidCallback? onCaptureBefore;
  final VoidCallback? onCancelOrder;
  final bool isActionLoading;
  final Widget? topBanner;
  final Widget? customerSection;
  final Widget? addOnsSection;

  const ProviderOrderServiceTimerView({
    super.key,
    required this.order,
    this.onFinishService,
    this.onTogglePause,
    this.onCaptureBefore,
    this.onCancelOrder,
    this.isActionLoading = false,
    this.topBanner,
    this.customerSection,
    this.addOnsSection,
  });

  @override
  State<ProviderOrderServiceTimerView> createState() =>
      _ProviderOrderServiceTimerViewState();
}

class _ProviderOrderServiceTimerViewState
    extends State<ProviderOrderServiceTimerView> {
  Timer? _ticker;

  bool get _isInProgress => widget.order['status']?.toString() == 'IN_PROGRESS';

  @override
  void initState() {
    super.initState();
    _syncTicker();
  }

  @override
  void didUpdateWidget(covariant ProviderOrderServiceTimerView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.order['status'] != widget.order['status'] ||
        oldWidget.order['startedAt'] != widget.order['startedAt'] ||
        oldWidget.order['workPausedAt'] != widget.order['workPausedAt']) {
      _syncTicker();
    }
  }

  void _syncTicker() {
    _ticker?.cancel();
    _ticker = null;
    if (_isInProgress && widget.order['workPausedAt'] == null) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  DateTime get _startTime {
    final raw = widget.order['startedAt']?.toString();
    final parsed = raw != null ? DateTime.tryParse(raw)?.toLocal() : null;
    return parsed ?? DateTime.now();
  }

  DateTime? get _pausedAt {
    final raw = widget.order['workPausedAt']?.toString();
    return raw != null ? DateTime.tryParse(raw)?.toLocal() : null;
  }

  Duration get _elapsed {
    if (!_isInProgress) return Duration.zero;
    final totalPausedSeconds =
        (widget.order['totalPausedSeconds'] as num?)?.toInt() ?? 0;
    final referenceEnd = _pausedAt ?? DateTime.now();
    final rawElapsed =
        referenceEnd.difference(_startTime) -
        Duration(seconds: totalPausedSeconds);
    return rawElapsed.isNegative ? Duration.zero : rawElapsed;
  }

  String _formatElapsed(Duration duration) {
    final hours = duration.inHours.toString().padLeft(2, '0');
    final minutes = (duration.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (duration.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours : $minutes : $seconds';
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final isArrived = !_isInProgress;
    final isPaused = _isInProgress && _pausedAt != null;
    final serviceName = order['serviceName']?.toString() ?? 'Dịch vụ';
    final durationMinutes = (order['durationMinutes'] as num?)?.toInt();
    final customerNote = order['customerNote']?.toString().trim() ?? '';
    final addressNote = order['addressNote']?.toString().trim() ?? '';

    final evidenceList = (order['evidence'] as List<dynamic>?) ?? const [];
    final beforeUrls = evidenceList
        .whereType<Map>()
        .where((e) => e['type'] == 'BEFORE_WORK')
        .map((e) => e['filePath']?.toString() ?? '')
        .where((url) => url.isNotEmpty)
        .toList();
    final hasBefore = evidenceList.any(
      (e) => e is Map && e['type'] == 'BEFORE_WORK',
    );
    final canCaptureBefore = isArrived && widget.onCaptureBefore != null;
    final canAddMoreBefore = canCaptureBefore && beforeUrls.length < 5;

    final customer = (order['customer'] as Map<String, dynamic>?) ?? {};
    final customerName =
        order['contactName']?.toString() ??
        customer['fullName']?.toString() ??
        'Khách hàng';

    final statusBadgeColor = isArrived
        ? const Color(0xFFEDE9FE)
        : isPaused
        ? const Color(0xFFFEF3C7)
        : const Color(0xFFF0FDFA);
    final statusTextColor = isArrived
        ? const Color(0xFF6D28D9)
        : isPaused
        ? const Color(0xFFB45309)
        : AppColors.primaryContainer;
    final statusIcon = isArrived
        ? Icons.location_on_rounded
        : isPaused
        ? Icons.pause_circle_filled_rounded
        : Icons.play_circle_filled_rounded;
    final statusText = isArrived
        ? 'Đã đến nơi · Sẵn sàng làm việc'
        : isPaused
        ? 'Đang tạm dừng làm việc'
        : 'Đang thực hiện dịch vụ';

    final String subtitleText;
    if (isArrived) {
      subtitleText = !hasBefore
          ? 'Chụp ảnh hiện trạng trước khi bắt đầu'
          : (durationMinutes == null
                ? 'Đã sẵn sàng · Nhấn "Bắt đầu làm việc" để tính giờ'
                : 'Dự kiến $durationMinutes phút · Nhấn "Bắt đầu làm việc" để tính giờ');
    } else {
      subtitleText = durationMinutes == null
          ? 'Bắt đầu lúc ${DateFormat('HH:mm').format(_startTime)}'
          : 'Bắt đầu lúc ${DateFormat('HH:mm').format(_startTime)} • Dự kiến $durationMinutes phút';
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 88),
      children: [
        if (widget.topBanner != null) widget.topBanner!,

        // Khối gộp: Đồng hồ thực hiện + Ảnh trước khi làm
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isPaused
                  ? const Color(0xFFFCD34D)
                  : const Color(0xFFE2E8F0),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x08000000),
                blurRadius: 14,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: statusBadgeColor,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusIcon, size: 16, color: statusTextColor),
                    const SizedBox(width: 6),
                    Text(
                      statusText,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: statusTextColor,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _formatElapsed(_elapsed),
                style: TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                  color: isArrived || isPaused
                      ? const Color(0xFF64748B)
                      : const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitleText,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF64748B),
                ),
              ),
              if (_isInProgress && widget.onTogglePause != null) ...[
                const SizedBox(height: 14),
                SizedBox(
                  height: 38,
                  child: OutlinedButton.icon(
                    onPressed: widget.isActionLoading
                        ? null
                        : widget.onTogglePause,
                    icon: Icon(
                      isPaused
                          ? Icons.play_arrow_rounded
                          : Icons.pause_rounded,
                      size: 18,
                    ),
                    label: Text(
                      isPaused ? 'Tiếp tục làm việc' : 'Tạm dừng làm việc',
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: isPaused
                          ? AppColors.primary
                          : const Color(0xFFB45309),
                      side: BorderSide(
                        color: isPaused
                            ? const Color(0xFF99F6E4)
                            : const Color(0xFFFCD34D),
                      ),
                      backgroundColor: isPaused
                          ? const Color(0xFFF0FDFA)
                          : const Color(0xFFFFFBEB),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
              ],

              if (canCaptureBefore || hasBefore) ...[
                const SizedBox(height: 14),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                const SizedBox(height: 12),
                _BeforeWorkSection(
                  hasBefore: hasBefore,
                  beforeUrls: beforeUrls,
                  canCaptureBefore: canCaptureBefore,
                  canAddMoreBefore: canAddMoreBefore,
                  isActionLoading: widget.isActionLoading,
                  onCaptureBefore: widget.onCaptureBefore,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),

        if (customerNote.isNotEmpty || addressNote.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDF4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFBBF7D0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      Icons.notes_rounded,
                      size: 16,
                      color: Color(0xFF16A34A),
                    ),
                    SizedBox(width: 6),
                    Text(
                      'Lưu ý từ khách hàng',
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF166534),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                if (customerNote.isNotEmpty)
                  Text(
                    customerNote,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: Color(0xFF14532D),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                if (addressNote.isNotEmpty)
                  Padding(
                    padding: EdgeInsets.only(
                      top: customerNote.isNotEmpty ? 4 : 0,
                    ),
                    child: Text(
                      'Chỉ dẫn địa chỉ: $addressNote',
                      style: const TextStyle(
                        fontSize: 12.5,
                        height: 1.35,
                        color: Color(0xFF166534),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
        ],

        if (widget.addOnsSection != null) widget.addOnsSection!,

        if (widget.customerSection != null)
          widget.customerSection!
        else
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  serviceName,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Khách hàng: $customerName',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF475569),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _BeforeWorkSection extends StatelessWidget {
  final bool hasBefore;
  final List<String> beforeUrls;
  final bool canCaptureBefore;
  final bool canAddMoreBefore;
  final bool isActionLoading;
  final VoidCallback? onCaptureBefore;

  const _BeforeWorkSection({
    required this.hasBefore,
    required this.beforeUrls,
    required this.canCaptureBefore,
    required this.canAddMoreBefore,
    required this.isActionLoading,
    this.onCaptureBefore,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              hasBefore ? Icons.check_circle_rounded : Icons.camera_alt_rounded,
              size: 16,
              color: hasBefore ? AppColors.primary : const Color(0xFF0F766E),
            ),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                hasBefore
                    ? 'Ảnh trước khi làm (${beforeUrls.isEmpty ? 1 : beforeUrls.length})'
                    : 'Ảnh hiện trạng trước khi làm',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (!hasBefore && canCaptureBefore)
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: isActionLoading ? null : onCaptureBefore,
              icon: const Icon(Icons.camera_alt_rounded, size: 18),
              label: const Text(
                'Mở camera chụp ảnh trước',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                backgroundColor: const Color(0xFFF0FDFA),
                side: const BorderSide(color: Color(0xFF99F6E4)),
                padding: const EdgeInsets.symmetric(vertical: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          )
        else if (beforeUrls.isNotEmpty || canAddMoreBefore)
          SizedBox(
            height: 76,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final url in beforeUrls) ...[
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Image.network(
                      url,
                      width: 76,
                      height: 76,
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) => Container(
                        width: 76,
                        height: 76,
                        color: const Color(0xFFF1F5F9),
                        child: const Icon(Icons.broken_image_outlined),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                if (canAddMoreBefore)
                  InkWell(
                    onTap: isActionLoading ? null : onCaptureBefore,
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      width: 76,
                      height: 76,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDFA),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF99F6E4)),
                      ),
                      child: const Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.add_a_photo_rounded,
                            size: 18,
                            color: AppColors.primary,
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Chụp thêm',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

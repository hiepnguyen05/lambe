import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';

class ProviderOrderServiceTimerView extends StatefulWidget {
  final Map<String, dynamic> order;
  final VoidCallback onFinishService;
  final Widget? addOnsSection;

  const ProviderOrderServiceTimerView({
    super.key,
    required this.order,
    required this.onFinishService,
    this.addOnsSection,
  });

  @override
  State<ProviderOrderServiceTimerView> createState() =>
      _ProviderOrderServiceTimerViewState();
}

class _ProviderOrderServiceTimerViewState
    extends State<ProviderOrderServiceTimerView> {
  Timer? _ticker;
  late DateTime _startTime;

  @override
  void initState() {
    super.initState();
    _initStartTime();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  void _initStartTime() {
    final rawStartedAt = widget.order['startedAt']?.toString();
    final parsed = rawStartedAt != null
        ? DateTime.tryParse(rawStartedAt)
        : null;
    _startTime = (parsed != null ? parsed.toLocal() : DateTime.now());
  }

  @override
  void didUpdateWidget(covariant ProviderOrderServiceTimerView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.order['startedAt'] != widget.order['startedAt']) {
      _initStartTime();
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _formatElapsed(Duration duration) {
    final hours = duration.inHours.toString().padLeft(2, '0');
    final minutes = (duration.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (duration.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours : $minutes : $seconds';
  }

  String _formatStartTime(DateTime time) {
    return DateFormat('HH:mm').format(time);
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;
    final serviceName = order['serviceName']?.toString() ?? 'Dịch vụ';
    final durationMinutes = (order['durationMinutes'] as num?)?.toInt();
    final customerNote = order['customerNote']?.toString();

    final customer = (order['customer'] as Map<String, dynamic>?) ?? {};
    final customerName = customer['fullName']?.toString() ?? 'Khách hàng';

    final elapsed = DateTime.now().difference(_startTime);

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [
        if (widget.addOnsSection != null) widget.addOnsSection!,
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 16,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.play_circle_filled_rounded,
                    size: 17,
                    color: AppColors.primaryContainer,
                  ),
                  SizedBox(width: 6),
                  Text(
                    'Đang thực hiện dịch vụ',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primaryContainer,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              Text(
                _formatElapsed(elapsed),
                style: const TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0,
                  color: Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 8),

              Text(
                durationMinutes == null
                    ? 'Bắt đầu lúc ${_formatStartTime(_startTime)}'
                    : 'Bắt đầu lúc ${_formatStartTime(_startTime)} • Dự kiến $durationMinutes phút',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x06000000),
                blurRadius: 10,
                offset: Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                serviceName,
                style: const TextStyle(
                  fontSize: 16,
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
        const SizedBox(height: 14),

        if (customerNote != null && customerNote.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.all(16),
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
                      size: 18,
                      color: Color(0xFF16A34A),
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Lưu ý của khách',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF166534),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  customerNote,
                  style: const TextStyle(
                    fontSize: 13.5,
                    height: 1.4,
                    color: Color(0xFF14532D),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
        ],

        const SizedBox(height: 16),

        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton.icon(
            onPressed: widget.onFinishService,
            icon: const Icon(Icons.camera_alt_rounded, size: 20),
            label: const Text(
              'Hoàn tất công việc và chụp kết quả',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                letterSpacing: 0,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 3,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }
}

import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/utils/currency_utils.dart';

class ProviderOrderSettlementCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final bool cashReceivedChecked;
  final ValueChanged<bool> onCashCheckChanged;
  final bool isActionLoading;
  final VoidCallback onConfirmComplete;
  final VoidCallback onReportUnpaid;
  final VoidCallback onBackToWork;
  final VoidCallback? onCaptureAfterMore;
  final bool completionBlocked;

  const ProviderOrderSettlementCard({
    super.key,
    required this.order,
    required this.cashReceivedChecked,
    required this.onCashCheckChanged,
    required this.isActionLoading,
    required this.onConfirmComplete,
    required this.onReportUnpaid,
    required this.onBackToWork,
    this.onCaptureAfterMore,
    this.completionBlocked = false,
  });

  String _formatCurrency(num? amount) =>
      amount == null ? '0đ' : CurrencyUtils.formatVnd(amount);

  String _workDurationText() {
    final startedRaw = order['startedAt']?.toString();
    final startedAt =
        startedRaw != null ? DateTime.tryParse(startedRaw)?.toLocal() : null;
    if (startedAt == null) return '--';
    final pausedRaw = order['workPausedAt']?.toString();
    final pausedAt =
        pausedRaw != null ? DateTime.tryParse(pausedRaw)?.toLocal() : null;
    final totalPausedSeconds = (order['totalPausedSeconds'] as num?)?.toInt() ?? 0;
    final refEnd = pausedAt ?? DateTime.now();
    var elapsed = refEnd.difference(startedAt) - Duration(seconds: totalPausedSeconds);
    if (elapsed.isNegative) elapsed = Duration.zero;
    final mins = elapsed.inMinutes;
    if (mins < 1) return '${elapsed.inSeconds} giây';
    final hours = elapsed.inHours;
    if (hours > 0) return '$hours giờ ${mins % 60} phút';
    return '$mins phút';
  }

  void _showPreview(BuildContext context, String url, String title) {
    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 14),
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  icon: const Icon(Icons.close, color: Colors.white),
                ),
              ],
            ),
            Flexible(
              child: Image.network(
                url,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'Không tải được ảnh',
                    style: TextStyle(color: Colors.white),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final totalAmount = (order['totalAmount'] as num?) ?? 0;
    final servicePrice = (order['servicePriceAmount'] as num?) ?? totalAmount;
    final travelFee = (order['travelFeeAmount'] as num?) ?? 0;
    final discountAmount = (order['discountAmount'] as num?) ?? 0;
    final platformFundedAmount = (order['platformFundedAmount'] as num?) ?? 0;
    final platformFee = (order['commissionAmount'] as num?)?.round() ?? 0;
    final commissionRateBps = (order['commissionRateBps'] as num?)?.toInt() ?? 0;
    final commissionPercent = commissionRateBps / 100;
    final netEarnings = totalAmount + platformFundedAmount - platformFee;

    final serviceName = order['serviceName']?.toString() ?? 'Dịch vụ';
    final customer = (order['customer'] as Map<String, dynamic>?) ?? {};
    final customerName =
        order['contactName']?.toString() ??
        customer['fullName']?.toString() ??
        'Khách hàng';
    final acceptedAddOns = (order['addOns'] as List? ?? [])
        .whereType<Map>()
        .where((row) => row['status'] == 'ACCEPTED')
        .toList();
    final evidenceList =
        (order['evidence'] as List? ?? []).whereType<Map>().toList();
    final beforeUrls = evidenceList
        .where((e) => e['type'] == 'BEFORE_WORK')
        .map((e) => e['filePath']?.toString() ?? '')
        .where((url) => url.isNotEmpty)
        .toList();
    final afterUrls = evidenceList
        .where((e) => e['type'] == 'AFTER_WORK')
        .map((e) => e['filePath']?.toString() ?? '')
        .where((url) => url.isNotEmpty)
        .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: onBackToWork,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              foregroundColor: AppColors.primary,
            ),
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 14),
            label: const Text(
              'Quay lại thực hiện',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            ),
          ),
        ),
        const SizedBox(height: 6),

        // 1. Số tiền phải thu (Sáng thoáng, chuẩn hệ thống)
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 20),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDFA),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF99F6E4)),
          ),
          child: Column(
            children: [
              const Text(
                'TỔNG TIỀN CẦN THU TỪ KHÁCH',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.4,
                  color: AppColors.primaryContainer,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _formatCurrency(totalAmount),
                style: const TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Thanh toán tiền mặt trực tiếp',
                style: TextStyle(
                  fontSize: 12.5,
                  color: AppColors.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),

        // 2. Tóm tắt thông tin đơn & Ảnh trước/sau
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Thông tin đơn hàng',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                ),
              ),
              const SizedBox(height: 10),
              _SummaryRow('Dịch vụ', serviceName),
              _SummaryRow('Khách hàng', customerName),
              _SummaryRow('Thời gian thực hiện', _workDurationText()),
              if (beforeUrls.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'Ảnh trước khi làm',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 76,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: beforeUrls.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, index) => _EvidenceThumbSquare(
                      url: beforeUrls[index],
                      onTap: () => _showPreview(
                        context,
                        beforeUrls[index],
                        'Ảnh trước khi làm (${index + 1})',
                      ),
                    ),
                  ),
                ),
              ],
              if (afterUrls.isNotEmpty || onCaptureAfterMore != null) ...[
                const SizedBox(height: 12),
                const Text(
                  'Ảnh kết quả sau khi làm',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 76,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      for (var i = 0; i < afterUrls.length; i++) ...[
                        _EvidenceThumbSquare(
                          url: afterUrls[i],
                          onTap: () => _showPreview(
                            context,
                            afterUrls[i],
                            'Ảnh kết quả (${i + 1})',
                          ),
                        ),
                        const SizedBox(width: 8),
                      ],
                      if (onCaptureAfterMore != null)
                        _AddPhotoTile(
                          onTap: isActionLoading ? null : onCaptureAfterMore,
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 12),

        // 3. Chi tiết thanh toán & Thu nhập
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Chi tiết thu & Chiết khấu',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurface,
                ),
              ),
              const SizedBox(height: 10),
              _SummaryRow('Giá dịch vụ', _formatCurrency(servicePrice)),
              for (final item in acceptedAddOns)
                _SummaryRow(
                  '${item['serviceName']} (phát sinh)',
                  '+${_formatCurrency(item['priceAmount'] as num?)}',
                ),
              if (travelFee > 0)
                _SummaryRow('Phí di chuyển', '+${_formatCurrency(travelFee)}'),
              if (discountAmount > 0)
                _SummaryRow(
                  'Khuyến mại / Voucher',
                  '-${_formatCurrency(discountAmount)}',
                  valueColor: const Color(0xFF16A34A),
                ),
              const Divider(height: 18, color: Color(0xFFF1F5F9)),
              _SummaryRow(
                'Tổng khách trả',
                _formatCurrency(totalAmount),
                isBold: true,
              ),
              if (platformFundedAmount > 0)
                _SummaryRow(
                  'Sàn hoàn trợ giá voucher',
                  '+${_formatCurrency(platformFundedAmount)}',
                  valueColor: const Color(0xFF16A34A),
                ),
              _SummaryRow(
                commissionRateBps > 0
                    ? 'Phí nền tảng (${commissionPercent.toStringAsFixed(1).replaceFirst('.0', '')}%)'
                    : 'Phí nền tảng',
                '-${_formatCurrency(platformFee)}',
                valueColor: const Color(0xFFDC2626),
              ),
              const Divider(height: 18, color: Color(0xFFF1F5F9)),
              _SummaryRow(
                'Thu nhập ròng',
                '+${_formatCurrency(netEarnings)}',
                isBold: true,
                valueColor: AppColors.primary,
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // 4. Xác nhận nhận tiền
        Material(
          color: cashReceivedChecked
              ? const Color(0xFFF0FDFA)
              : const Color(0xFFFFFBEB),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(
              color: cashReceivedChecked
                  ? AppColors.primaryContainer
                  : const Color(0xFFFDE68A),
            ),
          ),
          child: CheckboxListTile(
            value: cashReceivedChecked,
            onChanged: (val) => onCashCheckChanged(val ?? false),
            activeColor: AppColors.primary,
            controlAffinity: ListTileControlAffinity.leading,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 4,
            ),
            title: Text(
              'Xác nhận đã nhận đủ ${_formatCurrency(totalAmount)} tiền mặt',
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: AppColors.onSurface,
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),

        // 5. Nút Hoàn thành đơn hàng
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton.icon(
            onPressed:
                (cashReceivedChecked && !isActionLoading && !completionBlocked)
                ? onConfirmComplete
                : null,
            icon: isActionLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.check_circle_rounded, size: 22),
            label: Text(
              isActionLoading
                  ? 'Đang hoàn thành...'
                  : completionBlocked
                  ? 'Cần xử lý dịch vụ phát sinh trước'
                  : 'Hoàn thành đơn hàng',
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              disabledBackgroundColor: const Color(0xFFCBD5E1),
              foregroundColor: Colors.white,
              disabledForegroundColor: Colors.white,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Center(
          child: TextButton(
            onPressed: isActionLoading ? null : onReportUnpaid,
            child: const Text(
              'Khách chưa nhận đủ / thanh toán tiền?',
              style: TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final String value;
  final bool isBold;
  final Color? valueColor;

  const _SummaryRow(
    this.label,
    this.value, {
    this.isBold = false,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
                color: isBold ? AppColors.onSurface : AppColors.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            value,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
              color: valueColor ?? AppColors.onSurface,
            ),
          ),
        ],
      ),
    );
  }
}

class _EvidenceThumbSquare extends StatelessWidget {
  final String url;
  final VoidCallback onTap;

  const _EvidenceThumbSquare({required this.url, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Image.network(
          url,
          width: 76,
          height: 76,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Container(
            width: 76,
            height: 76,
            color: const Color(0xFFF1F5F9),
            child: const Icon(Icons.broken_image_outlined),
          ),
        ),
      ),
    );
  }
}

class _AddPhotoTile extends StatelessWidget {
  final VoidCallback? onTap;

  const _AddPhotoTile({this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
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
            Icon(Icons.add_a_photo_rounded, size: 20, color: AppColors.primary),
            SizedBox(height: 4),
            Text(
              'Chụp thêm',
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                color: AppColors.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

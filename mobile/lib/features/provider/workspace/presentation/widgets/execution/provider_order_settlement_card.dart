import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';

class ProviderOrderSettlementCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final bool cashReceivedChecked;
  final ValueChanged<bool> onCashCheckChanged;
  final bool isActionLoading;
  final VoidCallback onConfirmComplete;
  final VoidCallback onReportUnpaid;
  final VoidCallback onBackToEvidence;
  final Widget? addOnsSection;
  final bool completionBlocked;

  const ProviderOrderSettlementCard({
    super.key,
    required this.order,
    required this.cashReceivedChecked,
    required this.onCashCheckChanged,
    required this.isActionLoading,
    required this.onConfirmComplete,
    required this.onReportUnpaid,
    required this.onBackToEvidence,
    this.addOnsSection,
    this.completionBlocked = false,
  });

  String _formatCurrency(num? amount) {
    if (amount == null) return '0đ';
    final formatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );
    return formatter.format(amount);
  }

  @override
  Widget build(BuildContext context) {
    final totalAmount = (order['totalAmount'] as num?) ?? 0;
    final servicePrice = (order['servicePriceAmount'] as num?) ?? totalAmount;
    final travelFee = (order['travelFeeAmount'] as num?) ?? 0;
    final discountAmount = (order['discountAmount'] as num?) ?? 0;
    final platformFundedAmount = (order['platformFundedAmount'] as num?) ?? 0;
    final platformFee = (order['commissionAmount'] as num?)?.round() ?? 0;
    final commissionRateBps =
        (order['commissionRateBps'] as num?)?.toInt() ?? 0;
    final commissionPercent = commissionRateBps / 100;
    final netEarnings = totalAmount + platformFundedAmount - platformFee;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [
        if (addOnsSection != null) addOnsSection!,
        Row(
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: onBackToEvidence,
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.arrow_back_ios_new_rounded,
                        size: 14,
                        color: AppColors.primary,
                      ),
                      SizedBox(width: 6),
                      Text(
                        'Quay lại kiểm tra ảnh nghiệm thu',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
          decoration: BoxDecoration(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(12),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33005C55),
                blurRadius: 16,
                offset: Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.payments_rounded, size: 16, color: Colors.white),
                    SizedBox(width: 6),
                    Text(
                      'Tiền mặt cần thu từ khách',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                _formatCurrency(totalAmount),
                style: const TextStyle(
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Hình thức thanh toán: Tiền mặt khi hoàn thành',
                style: TextStyle(
                  fontSize: 12.5,
                  color: Colors.white.withValues(alpha: 0.85),
                  fontWeight: FontWeight.w500,
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
              const Row(
                children: [
                  Icon(
                    Icons.receipt_long_rounded,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Chi tiết thanh toán',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                      color: Color(0xFF6E7977),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildBillRow('Giá dịch vụ', _formatCurrency(servicePrice)),
              for (final item
                  in (order['addOns'] as List? ?? []).whereType<Map>().where(
                    (row) => row['status'] == 'ACCEPTED',
                  ))
                _buildBillRow(
                  '${item['serviceName']} (phát sinh)',
                  _formatCurrency(item['priceAmount'] as num?),
                ),
              if (travelFee > 0)
                _buildBillRow(
                  'Phí di chuyển',
                  '+${_formatCurrency(travelFee)}',
                ),
              if (discountAmount > 0)
                _buildBillRow(
                  'Khuyến mại / Voucher',
                  '-${_formatCurrency(discountAmount)}',
                  valueColor: const Color(0xFF16A34A),
                ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Divider(height: 1, color: Color(0xFFE2E8F0)),
              ),
              _buildBillRow(
                'Tổng tiền khách thanh toán',
                _formatCurrency(totalAmount),
                isBold: true,
                valueColor: const Color(0xFF0B1C30),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

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
                    Icons.account_balance_wallet_rounded,
                    size: 18,
                    color: Color(0xFF16A34A),
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Thu nhập từ đơn',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0,
                      color: Color(0xFF166534),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildBillRow(
                'Tiền mặt cầm về từ khách',
                '+${_formatCurrency(totalAmount)}',
                valueColor: const Color(0xFF15803D),
              ),
              if (platformFundedAmount > 0)
                _buildBillRow(
                  'Sàn hoàn tiền voucher vào ví',
                  '+${_formatCurrency(platformFundedAmount)}',
                  valueColor: const Color(0xFF15803D),
                ),
              _buildBillRow(
                commissionRateBps > 0
                    ? 'Phí nền tảng (${commissionPercent.toStringAsFixed(1).replaceFirst('.0', '')}%)'
                    : 'Phí nền tảng',
                '-${_formatCurrency(platformFee)}',
                valueColor: const Color(0xFFDC2626),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Divider(height: 1, color: Color(0xFFBBF7D0)),
              ),
              _buildBillRow(
                'Thu nhập ròng của đơn',
                '+${_formatCurrency(netEarnings)}',
                isBold: true,
                valueColor: const Color(0xFF166534),
              ),
              if (platformFundedAmount > 0) ...[
                const SizedBox(height: 6),
                const Text(
                  'Tiền mặt do khách thanh toán; phần voucher do sàn tài trợ được hoàn vào ví sau khi hoàn tất.',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF15803D),
                    height: 1.35,
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        Material(
          color: cashReceivedChecked
              ? const Color(0xFFEFF6F5)
              : const Color(0xFFFFFBEB),
          clipBehavior: Clip.antiAlias,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(
              color: cashReceivedChecked
                  ? AppColors.primaryContainer
                  : const Color(0xFFFDE68A),
              width: 1.5,
            ),
          ),
          child: CheckboxListTile(
            value: cashReceivedChecked,
            onChanged: (val) => onCashCheckChanged(val ?? false),
            activeColor: AppColors.primary,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 4,
            ),
            title: Text(
              'Tôi xác nhận đã nhận đủ ${_formatCurrency(totalAmount)} tiền mặt từ khách hàng',
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
            ),
            subtitle: const Padding(
              padding: EdgeInsets.only(top: 2),
              child: Text(
                'Lưu ý: Không bấm hoàn thành nếu chưa nhận đủ tiền mặt.',
                style: TextStyle(
                  fontSize: 11.5,
                  color: Color(0xFFB45309),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),

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
                  ? 'Đang hoàn tất đơn...'
                  : completionBlocked
                  ? 'Cần xử lý dịch vụ phát sinh trước'
                  : (cashReceivedChecked
                        ? 'Xác nhận đã thu tiền & Hoàn tất đơn'
                        : 'Cần tích chọn đã nhận đủ tiền'),
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                letterSpacing: 0,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              disabledBackgroundColor: const Color(0xFFCBD5E1),
              foregroundColor: Colors.white,
              disabledForegroundColor: Colors.white,
              elevation: cashReceivedChecked ? 4 : 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextButton.icon(
          onPressed: isActionLoading ? null : onReportUnpaid,
          icon: const Icon(Icons.report_problem_outlined),
          label: const Text('Chưa nhận đủ tiền từ khách'),
        ),
        const SizedBox(height: 40),
      ],
    );
  }

  Widget _buildBillRow(
    String label,
    String value, {
    bool isBold = false,
    Color? valueColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3.5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
              color: isBold ? const Color(0xFF0F172A) : const Color(0xFF475569),
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
              color:
                  valueColor ??
                  (isBold ? const Color(0xFF0F172A) : const Color(0xFF334155)),
            ),
          ),
        ],
      ),
    );
  }
}

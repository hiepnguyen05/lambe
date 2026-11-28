import 'package:flutter/material.dart';

import '../../../domain/entities/topup_response_entity.dart';

class SepayStatusHeader extends StatelessWidget {
  final TopUpResponseEntity topUp;
  final String pendingTitle;

  const SepayStatusHeader({
    super.key,
    required this.topUp,
    this.pendingTitle = 'Đang chờ chuyển khoản...',
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    if (topUp.isSucceeded) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.green.shade200),
        ),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: Colors.green.shade600,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check, color: Colors.white, size: 36),
            ),
            const SizedBox(height: 12),
            Text(
              'Nạp tiền thành công!',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: Colors.green.shade900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Số tiền đã được cộng vào Ví nhận đơn của bạn.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: Colors.green.shade800,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    if (topUp.isFailed || topUp.isExpired) {
      final isExp = topUp.isExpired;
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: colorScheme.errorContainer.withAlpha(80),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colorScheme.error.withAlpha(100)),
        ),
        child: Column(
          children: [
            Icon(
              isExp ? Icons.timer_off_outlined : Icons.error_outline,
              color: colorScheme.error,
              size: 48,
            ),
            const SizedBox(height: 12),
            Text(
              isExp ? 'Giao dịch đã hết hạn' : 'Giao dịch thất bại',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: colorScheme.error,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              topUp.resultMessage ??
                  (isExp
                      ? 'Thời gian chờ thanh toán đã quá hạn. Vui lòng tạo giao dịch mới.'
                      : 'Không thể xác nhận giao dịch. Vui lòng thử lại.'),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colorScheme.onErrorContainer,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    // PENDING_PAYMENT
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer.withAlpha(70),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.primary.withAlpha(50)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: colorScheme.primary,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pendingTitle,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: colorScheme.primary,
                  ),
                ),
                Text(
                  'Hệ thống tự động cộng tiền sau khi nhận giao dịch',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SepayTransactionCard extends StatelessWidget {
  final TopUpResponseEntity topUp;
  final String amountFormatted;
  final Duration remainingTime;
  final void Function(String text, String label) onCopy;

  const SepayTransactionCard({
    super.key,
    required this.topUp,
    required this.amountFormatted,
    required this.remainingTime,
    required this.onCopy,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final minutes = remainingTime.inMinutes;
    final seconds = remainingTime.inSeconds % 60;
    final timeStr =
        '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant.withAlpha(80)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Số tiền nạp',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              if (topUp.isPending && remainingTime.inSeconds > 0)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade100,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.timer_outlined,
                        size: 14,
                        color: Colors.amber.shade900,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        timeStr,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '$amountFormatted đ',
            style: theme.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: colorScheme.primary,
            ),
          ),
          const Divider(height: 28),
          _buildInfoRow(
            context,
            label: 'Mã đơn hàng / Nội dung',
            value: topUp.orderId,
            showCopy: true,
          ),
          const SizedBox(height: 12),
          _buildInfoRow(
            context,
            label: 'Cổng thanh toán',
            value: 'SePay (VietQR Sandbox)',
          ),
          const SizedBox(height: 12),
          _buildInfoRow(
            context,
            label: 'Phương thức',
            value: 'Chuyển khoản Ngân hàng 24/7',
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(
    BuildContext context, {
    required String label,
    required String value,
    bool showCopy = false,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
            if (showCopy) ...[
              const SizedBox(width: 6),
              InkWell(
                onTap: () => onCopy(value, label),
                borderRadius: BorderRadius.circular(4),
                child: Padding(
                  padding: const EdgeInsets.all(4.0),
                  child: Icon(Icons.copy, size: 16, color: colorScheme.primary),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class SepayInstructionCard extends StatelessWidget {
  const SepayInstructionCard({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant.withAlpha(50)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_outline, size: 20, color: colorScheme.primary),
              const SizedBox(width: 8),
              Text(
                'Hướng dẫn thanh toán SePay',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildInstructionStep(
            context,
            step: '1',
            text: 'Nhấn nút "Mở cổng thanh toán SePay" để hiển thị mã VietQR ngân hàng.',
          ),
          const SizedBox(height: 8),
          _buildInstructionStep(
            context,
            step: '2',
            text: 'Dùng ứng dụng ngân hàng bất kỳ để quét mã VietQR và xác nhận chuyển khoản.',
          ),
          const SizedBox(height: 8),
          _buildInstructionStep(
            context,
            step: '3',
            text: 'Sau khi chuyển khoản thành công, hệ thống SePay tự động cộng tiền trong 5-10 giây.',
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionStep(
    BuildContext context, {
    required String step,
    required String text,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: colorScheme.primary.withAlpha(25),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            step,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: colorScheme.primary,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';

class WalletMechanismInfo extends StatelessWidget {
  const WalletMechanismInfo({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(
                Icons.lightbulb_outline,
                color: colorScheme.primary,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                'Cơ chế hoạt động của Ví nhận đơn',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildStep(
            number: '1',
            title: 'Nạp tiền vào ví nhận đơn',
            description: 'Ký quỹ sẵn để kích hoạt trạng thái sẵn sàng đón đơn mới bất cứ lúc nào.',
            context: context,
          ),
          const SizedBox(height: 12),
          _buildStep(
            number: '2',
            title: 'Khách thanh toán trực tiếp',
            description: 'Bạn nhận trọn gói 100% chi phí dịch vụ trực tiếp từ khách hàng (tiền mặt / quét mã cá nhân).',
            context: context,
          ),
          const SizedBox(height: 12),
          _buildStep(
            number: '3',
            title: 'Hệ thống khấu trừ hoa hồng sàn',
            description: 'Phí nền tảng (15%) sẽ được tự động trừ nhẹ nhàng từ số dư Ví nhận đơn này sau khi hoàn tất.',
            context: context,
          ),
        ],
      ),
    );
  }

  Widget _buildStep({
    required String number,
    required String title,
    required String description,
    required BuildContext context,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          margin: const EdgeInsets.only(top: 2),
          decoration: BoxDecoration(
            color: colorScheme.primary,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            number,
            style: theme.textTheme.labelSmall?.copyWith(
              color: colorScheme.onPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: theme.textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                description,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

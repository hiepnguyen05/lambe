import 'package:flutter/material.dart';
import 'package:mobile/core/utils/currency_utils.dart';
import 'package:mobile/features/provider/workspace/application/provider_earnings_summary.dart';

class IncomeOverviewSection extends StatelessWidget {
  final double netIncome;
  final double grossIncome;
  final double commissionDeducted;
  final double platformSubsidy;
  final int completedOrders;
  final bool isLoading;
  final IncomePeriod selectedPeriod;
  final ValueChanged<IncomePeriod>? onPeriodChanged;

  const IncomeOverviewSection({
    super.key,
    this.netIncome = 0.0,
    this.grossIncome = 0.0,
    this.commissionDeducted = 0.0,
    this.platformSubsidy = 0.0,
    this.completedOrders = 0,
    this.isLoading = false,
    this.selectedPeriod = IncomePeriod.today,
    this.onPeriodChanged,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Tổng quan thu nhập',
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.bold,
            color: colorScheme.onSurface,
          ),
        ),
        const SizedBox(height: 10),

        // Segmented Filter Tabs
        Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: colorScheme.surfaceContainer,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            children: [
              Expanded(
                child: _buildTab(
                  'Hôm nay',
                  IncomePeriod.today,
                  selectedPeriod == IncomePeriod.today,
                  context,
                ),
              ),
              Expanded(
                child: _buildTab(
                  'Tuần này',
                  IncomePeriod.week,
                  selectedPeriod == IncomePeriod.week,
                  context,
                ),
              ),
              Expanded(
                child: _buildTab(
                  'Tháng này',
                  IncomePeriod.month,
                  selectedPeriod == IncomePeriod.month,
                  context,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        // Card Thu Thực Tế (Net Income)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colorScheme.surfaceContainerLowest,
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: colorScheme.shadow.withAlpha(5),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: colorScheme.primary.withAlpha(25),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.payments_outlined,
                        color: colorScheme.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Thực thu ròng của bạn',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: colorScheme.onSurfaceVariant,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (isLoading)
                            SizedBox(
                              height: 24,
                              width: 80,
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: colorScheme.primary,
                                ),
                              ),
                            )
                          else ...[
                            Text(
                              '${_formatCurrency(netIncome)} đ',
                              style: theme.textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: colorScheme.onSurface,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            if (platformSubsidy > 0)
                              Text(
                                'Đã gồm +${_formatCurrency(platformSubsidy)} đ trợ giá sàn',
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: colorScheme.primary,
                                  fontSize: 11,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: colorScheme.primary.withAlpha(25),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  '$completedOrders đơn xong',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colorScheme.primary,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),

        // Hai chỉ số phân tách: Thu từ khách & Hoa hồng đã khấu trừ
        Row(
          children: [
            Expanded(
              child: _buildSubStatCard(
                title: 'Khách trả trực tiếp',
                amount: '${_formatCurrency(grossIncome)} đ',
                icon: Icons.price_check,
                iconColor: colorScheme.onSurfaceVariant,
                amountColor: colorScheme.onSurface,
                isLoading: isLoading,
                context: context,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildSubStatCard(
                title: 'Hoa hồng trừ ví',
                amount: '- ${_formatCurrency(commissionDeducted)} đ',
                icon: Icons.trending_down,
                iconColor: colorScheme.secondary,
                amountColor: colorScheme.secondary,
                isLoading: isLoading,
                context: context,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTab(
    String text,
    IncomePeriod period,
    bool isActive,
    BuildContext context,
  ) {
    final colorScheme = Theme.of(context).colorScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onPeriodChanged != null ? () => onPeriodChanged!(period) : null,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 7),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isActive ? colorScheme.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          text,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: isActive
                ? colorScheme.onPrimary
                : colorScheme.onSurfaceVariant,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _buildSubStatCard({
    required String title,
    required String amount,
    required IconData icon,
    required Color iconColor,
    required Color amountColor,
    required bool isLoading,
    required BuildContext context,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: colorScheme.shadow.withAlpha(5),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: iconColor),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  title,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (isLoading)
            SizedBox(
              height: 20,
              width: 50,
              child: Align(
                alignment: Alignment.centerLeft,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colorScheme.primary,
                ),
              ),
            )
          else
            Text(
              amount,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: amountColor,
              ),
            ),
        ],
      ),
    );
  }

  String _formatCurrency(double amount) =>
      CurrencyUtils.vndDecimal.format(amount.round());
}

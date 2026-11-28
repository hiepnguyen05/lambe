import 'package:flutter/material.dart';
import 'package:mobile/core/utils/currency_utils.dart';

import '../../../domain/entities/wallet_transaction_entity.dart';

class TransactionHistoryList extends StatelessWidget {
  final List<WalletTransactionEntity> transactions;
  final bool isLoading;
  final String? errorMessage;
  final VoidCallback? onRetry;

  const TransactionHistoryList({
    super.key,
    required this.transactions,
    this.isLoading = false,
    this.errorMessage,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Lịch sử biến động ví',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
            Text(
              '${transactions.length} giao dịch',
              style: theme.textTheme.labelSmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (isLoading && transactions.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24.0),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (errorMessage != null && transactions.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colorScheme.errorContainer.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              children: [
                Text(
                  errorMessage!,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onErrorContainer,
                  ),
                ),
                if (onRetry != null) ...[
                  const SizedBox(height: 8),
                  TextButton(onPressed: onRetry, child: const Text('Thử lại')),
                ],
              ],
            ),
          )
        else if (transactions.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24.0),
            child: Center(child: Text('Chưa có giao dịch nào')),
          )
        else
          ...transactions.map((tx) {
            final isPositive = tx.isCredit;
            final prefix = isPositive ? '+' : '-';
            final d = tx.createdAt.day.toString().padLeft(2, '0');
            final m = tx.createdAt.month.toString().padLeft(2, '0');
            final h = tx.createdAt.hour.toString().padLeft(2, '0');
            final min = tx.createdAt.minute.toString().padLeft(2, '0');
            final dateStr = '$d/$m/${tx.createdAt.year} $h:$min';

            return Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: _buildTransactionItem(
                icon: _iconForType(tx.type),
                title: tx.displayTitle,
                orderCode: tx.shortOrderCode ?? '',
                subtitle: dateStr,
                availableAfterText:
                    'Khả dụng: ${CurrencyUtils.vndDecimal.format(tx.availableAfter.round())} đ',
                amount:
                    '$prefix${CurrencyUtils.vndDecimal.format(tx.amount.abs().round())} đ',
                amountLabel: tx.badgeLabel,
                isPositive: isPositive,
                context: context,
              ),
            );
          }),
      ],
    );
  }

  IconData _iconForType(TransactionType type) {
    switch (type) {
      case TransactionType.topUp:
        return Icons.add_card_rounded;
      case TransactionType.commissionDeduction:
        return Icons.receipt_long_rounded;
      case TransactionType.hold:
        return Icons.lock_clock_outlined;
      case TransactionType.release:
        return Icons.lock_open_rounded;
      case TransactionType.voucherReimbursement:
        return Icons.confirmation_num_outlined;
      case TransactionType.refund:
        return Icons.assignment_return_rounded;
      case TransactionType.withdrawal:
        return Icons.money_off_rounded;
      case TransactionType.manualAdjustment:
        return Icons.tune_rounded;
    }
  }

  Widget _buildTransactionItem({
    required IconData icon,
    required String title,
    required String orderCode,
    required String subtitle,
    required String availableAfterText,
    required String amount,
    required String amountLabel,
    required bool isPositive,
    required BuildContext context,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colorScheme.outlineVariant.withValues(alpha: 0.35),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              color: isPositive
                  ? colorScheme.primary.withAlpha(38)
                  : colorScheme.surfaceContainerHigh,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 18,
              color: isPositive
                  ? colorScheme.primary
                  : colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 6,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: colorScheme.onSurface,
                      ),
                    ),
                    if (orderCode.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: colorScheme.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          orderCode,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: colorScheme.primary,
                            fontWeight: FontWeight.w600,
                            fontSize: 10.5,
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  '$subtitle · $availableAfterText',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                    fontSize: 11.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                amount,
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: isPositive
                      ? colorScheme.primary
                      : colorScheme.secondary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                amountLabel,
                style: theme.textTheme.labelSmall?.copyWith(
                  fontSize: 11,
                  color: isPositive
                      ? colorScheme.primary
                      : colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

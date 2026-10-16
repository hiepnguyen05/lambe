import 'package:flutter/material.dart';

import '../../domain/entities/wallet_transaction_entity.dart';

class TransactionHistoryList extends StatelessWidget {
  final List<WalletTransactionEntity> transactions;
  final bool isLoading;

  const TransactionHistoryList({
    super.key,
    required this.transactions,
    this.isLoading = false,
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
              'Gần đây',
              style: theme.textTheme.labelSmall?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (isLoading)
          const Padding(
            padding: EdgeInsets.all(24.0),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (transactions.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24.0),
            child: Center(child: Text('Chưa có giao dịch nào')),
          )
        else
          ...transactions.map((tx) {
            IconData icon;
            String amountLabel;
            bool isPositive;
            String prefix = '';
            
            switch (tx.type) {
              case TransactionType.topUp:
                icon = Icons.add_card;
                amountLabel = 'Nạp tiền';
                isPositive = true;
                prefix = '+';
                break;
              case TransactionType.commissionDeduction:
                icon = Icons.receipt_long;
                amountLabel = 'Hoa hồng 15%';
                isPositive = false;
                prefix = '-';
                break;
              case TransactionType.refund:
                icon = Icons.assignment_return;
                amountLabel = 'Hoàn tiền';
                isPositive = true;
                prefix = '+';
                break;
              case TransactionType.withdrawal:
                icon = Icons.money_off;
                amountLabel = 'Rút tiền';
                isPositive = false;
                prefix = '-';
                break;
              case TransactionType.manualAdjustment:
                icon = Icons.tune;
                amountLabel = 'Điều chỉnh';
                isPositive = tx.amount > 0;
                prefix = tx.amount > 0 ? '+' : '';
                break;
            }

            final dateStr = '${tx.createdAt.day}/${tx.createdAt.month}/${tx.createdAt.year} ${tx.createdAt.hour}:${tx.createdAt.minute.toString().padLeft(2, '0')}';
            
            return Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
              child: _buildTransactionItem(
                icon: icon,
                title: tx.description.isNotEmpty ? tx.description : 'Giao dịch',
                orderId: tx.referenceId ?? '',
                subtitle: dateStr,
                amount: '$prefix${_formatCurrency(tx.amount.abs())} đ',
                amountLabel: amountLabel,
                isPositive: isPositive,
                context: context,
              ),
            );
          }),
      ],
    );
  }

  String _formatCurrency(double amount) {
    return amount.toInt().toString().replaceAllMapped(
      RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
      (Match m) => '${m[1]}.',
    );
  }

  Widget _buildTransactionItem({
    required IconData icon,
    required String title,
    required String orderId,
    required String subtitle,
    required String amount,
    required String amountLabel,
    required bool isPositive,
    required BuildContext context,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    
    return Container(
      padding: const EdgeInsets.all(16),
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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              color: isPositive ? colorScheme.primary.withAlpha(38) : colorScheme.surfaceContainerHigh,
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 18,
              color: isPositive ? colorScheme.primary : colorScheme.onSurfaceVariant,
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
                    if (orderId.isNotEmpty)
                      Text(
                        orderId,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: colorScheme.primary,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
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
                  color: isPositive ? colorScheme.primary : colorScheme.secondary,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                amountLabel,
                style: theme.textTheme.labelSmall?.copyWith(
                  fontSize: 11,
                  color: isPositive ? colorScheme.primary : colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/theme/app_colors.dart';

class ServiceDetailOverviewCard extends StatelessWidget {
  final String title;
  final String? description;
  final int minPriceAmount;

  const ServiceDetailOverviewCard({
    super.key,
    required this.title,
    this.description,
    required this.minPriceAmount,
  });

  @override
  Widget build(BuildContext context) {
    final details = description?.trim();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                const Text('GIÁ THAM KHẢO TỪ'),
                const SizedBox(height: 4),
                Text(
                  '${NumberFormat.decimalPattern('vi_VN').format(minPriceAmount)}₫',
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(color: AppColors.primary),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Giá của chuyên viên và phí di chuyển được xác nhận ở bước báo giá.',
                ),
              ],
            ),
          ),
          if (details != null && details.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(details, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_colors.dart';

class ServicePriceFilterModal extends StatefulWidget {
  final int? currentMaxPrice;
  final ValueChanged<int?> onApply;

  const ServicePriceFilterModal({
    super.key,
    required this.currentMaxPrice,
    required this.onApply,
  });

  static Future<void> show(
    BuildContext context, {
    required int? currentMaxPrice,
    required ValueChanged<int?> onApply,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ServicePriceFilterModal(
        currentMaxPrice: currentMaxPrice,
        onApply: onApply,
      ),
    );
  }

  @override
  State<ServicePriceFilterModal> createState() => _ServicePriceFilterModalState();
}

class _ServicePriceFilterModalState extends State<ServicePriceFilterModal> {
  late int? _tempPrice;

  final List<int> _presets = [
    150000,
    300000,
    500000,
    1000000,
    2000000,
  ];

  @override
  void initState() {
    super.initState();
    _tempPrice = widget.currentMaxPrice;
  }

  String _formatCurrency(int amount) {
    return NumberFormat.decimalPattern('vi_VN').format(amount);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      decoration: const BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Tiêu đề
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Lọc theo mức giá tối đa',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
                TextButton(
                  onPressed: () {
                    setState(() => _tempPrice = null);
                  },
                  child: const Text(
                    'Đặt lại',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Hiển thị giá đang chọn
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLow,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.surfaceContainer),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Giá dịch vụ tối đa:',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                  Text(
                    _tempPrice != null && _tempPrice! > 0
                        ? '${_formatCurrency(_tempPrice!)} ₫'
                        : 'Không giới hạn',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Các mức gợi ý nhanh
            const Text(
              'Chọn nhanh mức giá phù hợp:',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 10),

            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                // Preset: Tất cả
                ChoiceChip(
                  label: const Text('Tất cả'),
                  selected: _tempPrice == null,
                  onSelected: (selected) {
                    if (selected) setState(() => _tempPrice = null);
                  },
                  selectedColor: AppColors.primary.withValues(alpha: 0.15),
                  labelStyle: TextStyle(
                    color: _tempPrice == null ? AppColors.primary : AppColors.onSurface,
                    fontWeight: _tempPrice == null ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
                ..._presets.map((price) {
                  final isSelected = _tempPrice == price;
                  return ChoiceChip(
                    label: Text('≤ ${_formatCurrency(price)} ₫'),
                    selected: isSelected,
                    onSelected: (selected) {
                      setState(() => _tempPrice = selected ? price : null);
                    },
                    selectedColor: AppColors.primary.withValues(alpha: 0.15),
                    labelStyle: TextStyle(
                      color: isSelected ? AppColors.primary : AppColors.onSurface,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  );
                }),
              ],
            ),
            const SizedBox(height: 24),

            // Nút Áp dụng
            ElevatedButton(
              onPressed: () {
                widget.onApply(_tempPrice);
                Navigator.of(context).pop();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
                elevation: 0,
              ),
              child: const Text(
                'Áp dụng bộ lọc giá',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

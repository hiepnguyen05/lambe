import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/utils/currency_utils.dart';
import 'package:mobile/features/provider/services/domain/provider_offering.dart';

void showServicePickerModal({
  required BuildContext context,
  required List<ProviderOffering> items,
  required Set<String> selected,
  required bool disabled,
  required void Function(String id, bool selected) change,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) => _ServicePickerModal(
      items: items,
      selected: selected,
      disabled: disabled,
      change: change,
      formatPrice: CurrencyUtils.formatVnd,
    ),
  );
}

class FeedComposerServiceSection extends StatelessWidget {
  final List<ProviderOffering> items;
  final Set<String> selected;
  final bool disabled;
  final void Function(String id, bool selected) change;

  const FeedComposerServiceSection({
    super.key,
    required this.items,
    required this.selected,
    required this.disabled,
    required this.change,
  });

  String _formatPrice(int price) => CurrencyUtils.formatVnd(price);

  void _openSelectionSheet(BuildContext context) {
    showServicePickerModal(
      context: context,
      items: items,
      selected: selected,
      disabled: disabled,
      change: change,
    );
  }

  @override
  Widget build(BuildContext context) {
    final selectedOfferings = items
        .where((item) => selected.contains(item.id))
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Section Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.local_offer_outlined,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 6),
                  const Flexible(
                    child: Text(
                      'Dịch vụ gắn thẻ',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: selected.isEmpty
                          ? AppColors.surfaceContainerHigh
                          : AppColors.primaryFixed.withValues(alpha: 0.5),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Text(
                      '${selected.length}/5',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: selected.isEmpty
                            ? AppColors.textMuted
                            : AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (items.isNotEmpty && selected.length < 5)
              TextButton.icon(
                onPressed: disabled ? null : () => _openSelectionSheet(context),
                icon: const Icon(Icons.add_rounded, size: 16),
                label: const Text(
                  'Chọn thêm',
                  style: TextStyle(
                    fontFamily: 'Plus Jakarta Sans',
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  visualDensity: VisualDensity.compact,
                ),
              ),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'Gắn 1–5 dịch vụ để kích hoạt nút đặt lịch trực tiếp trên bài viết của bạn.',
          style: TextStyle(
            fontFamily: 'Plus Jakarta Sans',
            fontSize: 12,
            color: AppColors.textMuted,
          ),
        ),
        const SizedBox(height: 10),

        if (items.isEmpty)
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Row(
              children: [
                Icon(
                  Icons.info_outline_rounded,
                  size: 18,
                  color: AppColors.textMuted,
                ),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Chưa có dịch vụ đang hoạt động. Hãy thêm dịch vụ trong phần cài đặt trước.',
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ),
              ],
            ),
          )
        else if (selectedOfferings.isEmpty)
          InkWell(
            onTap: disabled ? null : () => _openSelectionSheet(context),
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.2),
                  width: 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.local_offer_outlined,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      'Gắn thẻ dịch vụ cho bài viết này',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          Column(
            children: [
              for (final offering in selectedOfferings)
                Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.18),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.02),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.08),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.spa_outlined,
                          size: 16,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              offering.service.name,
                              style: const TextStyle(
                                fontFamily: 'Plus Jakarta Sans',
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.onSurface,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${_formatPrice(offering.price)} · ${offering.effectiveDuration ?? 30} phút',
                              style: const TextStyle(
                                fontFamily: 'Plus Jakarta Sans',
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(
                          Icons.close_rounded,
                          size: 18,
                          color: AppColors.textMuted,
                        ),
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        tooltip: 'Bỏ gắn thẻ',
                        onPressed: disabled ? null : () => change(offering.id, false),
                      ),
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }
}

class _ServicePickerModal extends StatefulWidget {
  final List<ProviderOffering> items;
  final Set<String> selected;
  final bool disabled;
  final void Function(String id, bool selected) change;
  final String Function(int) formatPrice;

  const _ServicePickerModal({
    required this.items,
    required this.selected,
    required this.disabled,
    required this.change,
    required this.formatPrice,
  });

  @override
  State<_ServicePickerModal> createState() => _ServicePickerModalState();
}

class _ServicePickerModalState extends State<_ServicePickerModal> {
  final _searchController = TextEditingController();
  String _filter = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.items.where((item) {
      if (_filter.isEmpty) return true;
      return item.service.name.toLowerCase().contains(_filter.toLowerCase());
    }).toList(growable: false);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.75,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.outlineVariant,
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Chọn dịch vụ gắn thẻ',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                    ),
                    Text(
                      'Tối đa 5 dịch vụ (${widget.selected.length}/5)',
                      style: const TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text(
                    'Xong',
                    style: TextStyle(
                      fontFamily: 'Plus Jakarta Sans',
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Search Field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: TextField(
              controller: _searchController,
              onChanged: (val) => setState(() => _filter = val.trim()),
              decoration: InputDecoration(
                hintText: 'Tìm kiếm dịch vụ...',
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  size: 20,
                  color: AppColors.textMuted,
                ),
                suffixIcon: _filter.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _filter = '');
                        },
                      )
                    : null,
                filled: true,
                fillColor: AppColors.surfaceContainerLowest,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(
                    color: AppColors.surfaceContainerHighest,
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide(
                    color: AppColors.surfaceContainerHighest,
                  ),
                ),
              ),
            ),
          ),

          // Offerings List
          Expanded(
            child: filtered.isEmpty
                ? const Center(
                    child: Text(
                      'Không tìm thấy dịch vụ phù hợp.',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textMuted,
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    itemCount: filtered.length,
                    separatorBuilder: (_, __) => const Divider(
                      height: 1,
                      indent: 48,
                      color: AppColors.surfaceContainerHigh,
                    ),
                    itemBuilder: (context, index) {
                      final offering = filtered[index];
                      final isSelected = widget.selected.contains(offering.id);
                      final canSelect =
                          isSelected || widget.selected.length < 5;

                      return CheckboxListTile(
                        value: isSelected,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 2,
                        ),
                        activeColor: AppColors.primary,
                        title: Text(
                          offering.service.name,
                          style: TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 14,
                            fontWeight: isSelected
                                ? FontWeight.w700
                                : FontWeight.w500,
                            color: canSelect
                                ? AppColors.onSurface
                                : AppColors.textMuted,
                          ),
                        ),
                        subtitle: Text(
                          '${widget.formatPrice(offering.price)} · ${offering.effectiveDuration ?? 30} phút',
                          style: const TextStyle(
                            fontFamily: 'Plus Jakarta Sans',
                            fontSize: 12,
                            color: AppColors.primary,
                          ),
                        ),
                        onChanged: widget.disabled || !canSelect
                            ? null
                            : (val) {
                                setState(() {
                                  widget.change(offering.id, val == true);
                                });
                              },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import '../../../domain/entities/booking_provider_candidate_entity.dart';

class SelectProviderBottomBar extends StatelessWidget {
  final BookingProviderCandidateEntity? selectedCandidate;
  final VoidCallback onContinue;

  const SelectProviderBottomBar({
    super.key,
    required this.selectedCandidate,
    required this.onContinue,
  });

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    final isSelected = selectedCandidate != null;

    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        14,
        20,
        MediaQuery.of(context).padding.bottom + 14,
      ),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLowest,
        border: const Border(
          top: BorderSide(color: AppColors.surfaceContainerHigh, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.onBackground.withValues(alpha: 0.05),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          // Hiển thị chuyên viên & giá đã chọn (nếu có)
          if (isSelected) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: 42,
                height: 42,
                color: AppColors.surfaceContainerLow,
                child: selectedCandidate!.avatarUrl != null &&
                        selectedCandidate!.avatarUrl!.startsWith('http')
                    ? CachedNetworkImage(
                        imageUrl: selectedCandidate!.avatarUrl!,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(
                          color: AppColors.surfaceContainerLow,
                          child: const Icon(
                            Icons.person_rounded,
                            size: 20,
                            color: AppColors.textMuted,
                          ),
                        ),
                        errorWidget: (_, __, ___) => const Icon(
                          Icons.person_rounded,
                          size: 20,
                          color: AppColors.textMuted,
                        ),
                      )
                    : const Icon(
                        Icons.person_rounded,
                        size: 20,
                        color: AppColors.textMuted,
                      ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 105),
                  child: Text(
                    selectedCandidate!.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.onBackground,
                    ),
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  currencyFormatter.format(selectedCandidate!.priceAmount),
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                    letterSpacing: -0.3,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 14),
          ],

          // Nút bấm Tiếp tục sang Bước 3: Xác nhận đơn
          Expanded(
            child: SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: isSelected ? onContinue : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: AppColors.onPrimary,
                  disabledBackgroundColor: AppColors.surfaceContainerHigh,
                  disabledForegroundColor: AppColors.textMuted,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        isSelected
                            ? 'Tiếp tục'
                            : 'Chọn chuyên viên',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (isSelected) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.arrow_forward_rounded, size: 18),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

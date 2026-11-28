import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/core/utils/currency_utils.dart';

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
    final currencyFormatter = CurrencyUtils.vndCurrency;

    final isSelected = selectedCandidate != null;

    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        MediaQuery.of(context).padding.bottom + 12,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, -3),
          ),
        ],
      ),
      child: Row(
        children: [
          // Hiển thị chuyên viên & giá đã chọn (nếu có)
          if (isSelected) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 42,
                height: 42,
                color: const Color(0xFFEFF6F5),
                child: selectedCandidate!.avatarUrl != null &&
                        selectedCandidate!.avatarUrl!.startsWith('http')
                    ? CachedNetworkImage(
                        imageUrl: selectedCandidate!.avatarUrl!,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => const Icon(
                          Icons.person_rounded,
                          size: 20,
                          color: Color(0xFF0F766E),
                        ),
                        errorWidget: (_, __, ___) => const Icon(
                          Icons.person_rounded,
                          size: 20,
                          color: Color(0xFF0F766E),
                        ),
                      )
                    : const Icon(
                        Icons.person_rounded,
                        size: 20,
                        color: Color(0xFF0F766E),
                      ),
              ),
            ),
            const SizedBox(width: 10),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 120),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    selectedCandidate!.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    currencyFormatter.format(selectedCandidate!.priceAmount),
                    style: const TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w800,
                      color: Color(0xFF0F766E),
                      letterSpacing: -0.3,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
          ],

          // Nút bấm Tiếp tục sang Bước 3: Xác nhận đơn
          Expanded(
            child: SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: isSelected ? onContinue : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFFE2E8F0),
                  disabledForegroundColor: const Color(0xFF94A3B8),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
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
                        isSelected ? 'Tiếp tục' : 'Chọn chuyên viên',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14.5,
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

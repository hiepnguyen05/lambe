import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

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
        color: Colors.white,
        border: const Border(
          top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.05),
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
              borderRadius: BorderRadius.circular(10),
              child: Container(
                width: 38,
                height: 38,
                color: const Color(0xFFF1F5F9),
                child: selectedCandidate!.avatarUrl != null &&
                        selectedCandidate!.avatarUrl!.startsWith('http')
                    ? Image.network(
                        selectedCandidate!.avatarUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.person,
                          size: 20,
                          color: Color(0xFF94A3B8),
                        ),
                      )
                    : const Icon(
                        Icons.person,
                        size: 20,
                        color: Color(0xFF94A3B8),
                      ),
              ),
            ),
            const SizedBox(width: 10),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 120),
                  child: Text(
                    selectedCandidate!.displayName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  currencyFormatter.format(selectedCandidate!.priceAmount),
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F766E),
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
                  backgroundColor: isSelected
                      ? const Color(0xFF0F766E)
                      : const Color(0xFFCBD5E1),
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: const Color(0xFFF1F5F9),
                  disabledForegroundColor: const Color(0xFF94A3B8),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      isSelected
                          ? 'Tiếp tục xác nhận'
                          : 'Chọn chuyên viên để tiếp tục',
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (isSelected) ...[
                      const SizedBox(width: 8),
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

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/entities/booking_draft_entity.dart';
import '../../providers/booking_draft_provider.dart';
import './booking_address_selection_bottom_sheet.dart';

class BookingConfigAddressSection extends ConsumerStatefulWidget {
  final BookingDraftEntity draft;

  const BookingConfigAddressSection({super.key, required this.draft});

  @override
  ConsumerState<BookingConfigAddressSection> createState() =>
      _BookingConfigAddressSectionState();
}

class _BookingConfigAddressSectionState
    extends ConsumerState<BookingConfigAddressSection> {
  // Retained for Flutter Hot Reload compatibility
  TextEditingController? _nameController;
  TextEditingController? _phoneController;

  @override
  void dispose() {
    _nameController?.dispose();
    _phoneController?.dispose();
    super.dispose();
  }

  void _showAddressSelectionModal(BuildContext context) {
    BookingAddressSelectionBottomSheet.show(
      context,
      selectedAddressId: widget.draft.customerAddressId,
      onSelect: (address) {
        ref.read(bookingDraftProvider.notifier).selectSavedAddress(address);
        Navigator.of(context).pop();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final selectedAddress = widget.draft.selectedAddress;
    final inlineAddress = widget.draft.inlineAddress;
    final hasAddress = widget.draft.hasValidAddress;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tiêu đề phần địa chỉ
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6F5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.location_on_rounded,
                  color: Color(0xFF0F766E),
                  size: 16,
                ),
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Địa chỉ đón chuyên viên',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              if (hasAddress)
                const SizedBox(width: 8),
              if (hasAddress)
                TextButton(
                  onPressed: () => _showAddressSelectionModal(context),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF0F766E),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Đổi địa chỉ',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      SizedBox(width: 2),
                      Icon(Icons.chevron_right_rounded, size: 16),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),

          // Khối hiển thị địa chỉ đã chọn
          if (hasAddress)
            InkWell(
              onTap: () => _showAddressSelectionModal(context),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Icon(
                        Icons.home_outlined,
                        color: Color(0xFF0F766E),
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (selectedAddress?.label?.isNotEmpty ?? false)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 2),
                              child: Text(
                                selectedAddress!.label!,
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                            ),
                          Text(
                            selectedAddress?.addressLine ??
                                inlineAddress?.addressLine ??
                                '',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF0B1C30),
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Padding(
                      padding: EdgeInsets.only(top: 2),
                      child: Icon(
                        Icons.chevron_right_rounded,
                        color: Color(0xFF94A3B8),
                        size: 18,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            // Chưa chọn địa chỉ -> Bấm để chọn
            InkWell(
              onTap: () => _showAddressSelectionModal(context),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0xFFCBD5E1),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.add_location_alt_outlined,
                      color: Color(0xFF0F766E),
                      size: 18,
                    ),
                    SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        'Chọn hoặc thêm địa chỉ đón chuyên viên',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

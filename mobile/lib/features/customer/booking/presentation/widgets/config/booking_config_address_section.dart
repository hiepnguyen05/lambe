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
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.draft.contactName);
    _phoneController = TextEditingController(text: widget.draft.contactPhone);
  }

  @override
  void didUpdateWidget(covariant BookingConfigAddressSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.draft.contactName != widget.draft.contactName &&
        _nameController.text != widget.draft.contactName) {
      _nameController.text = widget.draft.contactName;
    }
    if (oldWidget.draft.contactPhone != widget.draft.contactPhone &&
        _phoneController.text != widget.draft.contactPhone) {
      _phoneController.text = widget.draft.contactPhone;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
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
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 3),
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
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6F5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.location_on_rounded,
                  color: Color(0xFF0F766E),
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Địa chỉ & Người nhận',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                  letterSpacing: -0.2,
                ),
              ),
              const Spacer(),
              if (hasAddress)
                TextButton(
                  onPressed: () => _showAddressSelectionModal(context),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF0F766E),
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text(
                    'Đổi địa chỉ',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),

          // Khối hiển thị địa chỉ đã chọn
          if (hasAddress)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8F9FF),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.home_work_outlined,
                    color: Color(0xFF0F766E),
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (selectedAddress?.label?.isNotEmpty ?? false)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            margin: const EdgeInsets.only(bottom: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEFF6F5),
                              borderRadius: BorderRadius.circular(4),
                            ),
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
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF0B1C30),
                            height: 1.35,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else
            // Chưa chọn địa chỉ -> Bấm để chọn
            InkWell(
              onTap: () => _showAddressSelectionModal(context),
              borderRadius: BorderRadius.circular(14),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 16,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: const Color(0xFFCBD5E1),
                    style: BorderStyle.solid,
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.add_location_alt_outlined,
                      color: Color(0xFF0F766E),
                      size: 20,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Chọn hoặc thêm địa chỉ đón chuyên viên',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 16),

          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 14),

          // Thông tin người nhận
          const Text(
            'Thông tin người đón chuyên viên',
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF334155),
            ),
          ),
          const SizedBox(height: 10),

          // Họ tên người nhận
          TextField(
            controller: _nameController,
            onChanged: (val) {
              ref.read(bookingDraftProvider.notifier).setContactName(val);
            },
            decoration: InputDecoration(
              labelText: 'Họ và tên người nhận',
              labelStyle: const TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
              ),
              hintText: 'Nhập họ tên',
              hintStyle: const TextStyle(
                fontSize: 13,
                color: Color(0xFF94A3B8),
              ),
              prefixIcon: const Icon(
                Icons.person_outline,
                size: 20,
                color: Color(0xFF64748B),
              ),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: Color(0xFF0F766E),
                  width: 1.5,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Số điện thoại người nhận
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            onChanged: (val) {
              ref.read(bookingDraftProvider.notifier).setContactPhone(val);
            },
            decoration: InputDecoration(
              labelText: 'Số điện thoại',
              labelStyle: const TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
              ),
              hintText: 'Ví dụ: 0912345678',
              hintStyle: const TextStyle(
                fontSize: 13,
                color: Color(0xFF94A3B8),
              ),
              prefixIcon: const Icon(
                Icons.phone_outlined,
                size: 20,
                color: Color(0xFF64748B),
              ),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 14,
                vertical: 12,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(
                  color: Color(0xFF0F766E),
                  width: 1.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

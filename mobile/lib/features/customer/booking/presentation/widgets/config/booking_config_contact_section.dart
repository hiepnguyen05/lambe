import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/entities/booking_draft_entity.dart';
import '../../providers/booking_draft_provider.dart';

class BookingConfigContactSection extends ConsumerStatefulWidget {
  final BookingDraftEntity draft;

  const BookingConfigContactSection({super.key, required this.draft});

  @override
  ConsumerState<BookingConfigContactSection> createState() =>
      _BookingConfigContactSectionState();
}

class _BookingConfigContactSectionState
    extends ConsumerState<BookingConfigContactSection> {
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.draft.contactName);
    _phoneController = TextEditingController(text: widget.draft.contactPhone);
  }

  @override
  void didUpdateWidget(covariant BookingConfigContactSection oldWidget) {
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

  @override
  Widget build(BuildContext context) {
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
                  Icons.person_outline_rounded,
                  color: Color(0xFF0F766E),
                  size: 17,
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Thông tin người nhận',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                flex: 5,
                child: TextField(
                  controller: _nameController,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0B1C30),
                  ),
                  onChanged: (val) {
                    ref.read(bookingDraftProvider.notifier).setContactName(val);
                  },
                  decoration: InputDecoration(
                    labelText: 'Người nhận',
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                    ),
                    hintText: 'Họ và tên',
                    hintStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF94A3B8),
                    ),
                    prefixIcon: const Icon(
                      Icons.person_outline,
                      size: 16,
                      color: Color(0xFF64748B),
                    ),
                    prefixIconConstraints: const BoxConstraints(minWidth: 32),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 10,
                    ),
                    isDense: true,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(
                        color: Color(0xFF0F766E),
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 5,
                child: TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0B1C30),
                  ),
                  onChanged: (val) {
                    ref.read(bookingDraftProvider.notifier).setContactPhone(val);
                  },
                  decoration: InputDecoration(
                    labelText: 'Số điện thoại',
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF64748B),
                    ),
                    hintText: '09xxxxxxxx',
                    hintStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF94A3B8),
                    ),
                    prefixIcon: const Icon(
                      Icons.phone_outlined,
                      size: 16,
                      color: Color(0xFF64748B),
                    ),
                    prefixIconConstraints: const BoxConstraints(minWidth: 32),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 10,
                    ),
                    isDense: true,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(
                        color: Color(0xFF0F766E),
                        width: 1.5,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}


import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/entities/booking_draft_entity.dart';
import '../../providers/booking_draft_provider.dart';

class BookingConfigNoteSection extends ConsumerStatefulWidget {
  final BookingDraftEntity draft;

  const BookingConfigNoteSection({super.key, required this.draft});

  @override
  ConsumerState<BookingConfigNoteSection> createState() =>
      _BookingConfigNoteSectionState();
}

class _BookingConfigNoteSectionState
    extends ConsumerState<BookingConfigNoteSection> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.draft.customerNote);
  }

  @override
  void didUpdateWidget(covariant BookingConfigNoteSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.draft.customerNote != widget.draft.customerNote &&
        _controller.text != widget.draft.customerNote) {
      _controller.text = widget.draft.customerNote;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
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
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6F5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.edit_note_rounded,
                  color: Color(0xFF0F766E),
                  size: 20,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Ghi chú cho chuyên viên',
                style: TextStyle(
                  fontSize: 15.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0B1C30),
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(width: 6),
              const Text(
                '(Tùy chọn)',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFF94A3B8),
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _controller,
            maxLines: 2,
            maxLength: 300,
            onChanged: (val) {
              ref.read(bookingDraftProvider.notifier).setCustomerNote(val);
            },
            style: const TextStyle(
              fontSize: 13.5,
              color: Color(0xFF0B1C30),
            ),
            decoration: InputDecoration(
              counterText: '',
              hintText: 'Lưu ý cho chuyên viên (chỉ đường, dặn dò trước khi đến...)',
              hintStyle: const TextStyle(
                fontSize: 13,
                color: Color(0xFF94A3B8),
                height: 1.35,
              ),
              filled: true,
              fillColor: const Color(0xFFF8FAFC),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
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

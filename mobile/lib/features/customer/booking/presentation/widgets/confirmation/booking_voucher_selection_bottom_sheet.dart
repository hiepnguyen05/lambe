import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../providers/booking_confirmation_providers.dart';
import '../../../domain/entities/voucher_entity.dart';

class BookingVoucherSelectionBottomSheet extends ConsumerStatefulWidget {
  final String providerServiceId;
  final String? currentVoucherCode;
  final ValueChanged<String?> onVoucherSelected;

  const BookingVoucherSelectionBottomSheet({
    super.key,
    required this.providerServiceId,
    required this.currentVoucherCode,
    required this.onVoucherSelected,
  });

  static Future<void> show(
    BuildContext context, {
    required String providerServiceId,
    required String? currentVoucherCode,
    required ValueChanged<String?> onVoucherSelected,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => BookingVoucherSelectionBottomSheet(
        providerServiceId: providerServiceId,
        currentVoucherCode: currentVoucherCode,
        onVoucherSelected: onVoucherSelected,
      ),
    );
  }

  @override
  ConsumerState<BookingVoucherSelectionBottomSheet> createState() =>
      _BookingVoucherSelectionBottomSheetState();
}

class _BookingVoucherSelectionBottomSheetState
    extends ConsumerState<BookingVoucherSelectionBottomSheet> {
  final TextEditingController _customCodeController = TextEditingController();
  String? _selectedCode;

  @override
  void initState() {
    super.initState();
    _selectedCode = widget.currentVoucherCode;
  }

  @override
  void dispose() {
    _customCodeController.dispose();
    super.dispose();
  }

  void _fetchVouchers() {
    ref.invalidate(eligibleVouchersProvider(widget.providerServiceId));
  }

  void _applyManualCode() {
    final code = _customCodeController.text.trim().toUpperCase();
    if (code.isEmpty) return;
    widget.onVoucherSelected(code);
    Navigator.of(context).pop();
  }

  void _selectVoucher(String code) {
    widget.onVoucherSelected(code);
    Navigator.of(context).pop();
  }

  void _removeVoucher() {
    widget.onVoucherSelected(null);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormat = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.82,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          const SizedBox(height: 12),
          Container(
            width: 44,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(
                      Icons.confirmation_num_rounded,
                      color: Color(0xFF0F766E),
                      size: 22,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Ưu đãi & Voucher',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                if (_selectedCode != null)
                  TextButton(
                    onPressed: _removeVoucher,
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFFDC2626),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                    ),
                    child: const Text(
                      'Bỏ chọn',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Manual input bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Expanded(
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: TextField(
                      controller: _customCodeController,
                      textCapitalization: TextCapitalization.characters,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                      decoration: const InputDecoration(
                        hintText: 'Nhập mã giảm giá...',
                        hintStyle: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.normal,
                          color: Color(0xFF94A3B8),
                        ),
                        contentPadding: EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        border: InputBorder.none,
                      ),
                      onSubmitted: (_) => _applyManualCode(),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                SizedBox(
                  height: 44,
                  child: ElevatedButton(
                    onPressed: _applyManualCode,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    child: const Text(
                      'Áp dụng',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Voucher list
          Expanded(
            child: _buildVoucherContent(
              currencyFormat,
              ref.watch(eligibleVouchersProvider(widget.providerServiceId)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVoucherContent(
    NumberFormat currencyFormat,
    AsyncValue<List<VoucherEntity>> vouchersAsync,
  ) {
    return vouchersAsync.when(
      loading: () => const Center(
        child: CircularProgressIndicator(color: Color(0xFF0F766E)),
      ),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 40,
                color: Color(0xFFDC2626),
              ),
              const SizedBox(height: 10),
              Text(
                e.toString().replaceFirst('Exception: ', ''),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 14),
              ElevatedButton(
                onPressed: _fetchVouchers,
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
      ),
      data: (vouchers) {
        if (vouchers.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.local_offer_outlined,
                      size: 32,
                      color: Color(0xFF94A3B8),
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Không có mã ưu đãi phù hợp',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Hiện chưa có voucher nào áp dụng được cho dịch vụ này. Bạn có thể nhập mã ưu đãi thủ công phía trên nếu có.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                  ),
                ],
              ),
            ),
          );
        }

        return ListView.builder(
          padding: EdgeInsets.fromLTRB(
            20,
            14,
            20,
            MediaQuery.of(context).padding.bottom + 16,
          ),
          itemCount: vouchers.length,
          itemBuilder: (ctx, index) {
            final v = vouchers[index];
            final isSelected = _selectedCode == v.code;
            final isPlatform = v.isPlatform;
            final accentColor = isPlatform
                ? const Color(0xFF0F766E)
                : const Color(0xFF7C3AED);
            final lightBg = isPlatform
                ? const Color(0xFFF0FDF4)
                : const Color(0xFFFAF5FF);
            final borderColor = isPlatform
                ? const Color(0xFF99F6E4)
                : const Color(0xFFDDD6FE);

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: isSelected ? lightBg : Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: isSelected ? accentColor : borderColor,
                  width: isSelected ? 1.5 : 1,
                ),
                boxShadow: [
                  BoxShadow(
                    color: accentColor.withValues(alpha: 0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  onTap: () => _selectVoucher(v.code),
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Icon voucher
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: lightBg,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: borderColor),
                          ),
                          child: Icon(
                            Icons.confirmation_num_outlined,
                            color: accentColor,
                            size: 22,
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Info
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    v.code,
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                      color: accentColor,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: isPlatform
                                          ? const Color(0xFFCCFBF1)
                                          : const Color(0xFFEDE9FE),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      v.issuerLabel,
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.bold,
                                        color: accentColor,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                v.discountLabel,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                v.minOrderAmount > 0
                                    ? 'Đơn tối thiểu ${currencyFormat.format(v.minOrderAmount)}'
                                    : 'Áp dụng cho mọi giá trị dịch vụ',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: Color(0xFF64748B),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'HSD: ${DateFormat('dd/MM/yyyy').format(v.endsAt)} • Tiết kiệm ~${currencyFormat.format(v.estimatedDiscountAmount)}',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: accentColor,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Radio indicator
                        Container(
                          margin: const EdgeInsets.only(top: 2),
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isSelected ? accentColor : Colors.white,
                            border: Border.all(
                              color: isSelected
                                  ? accentColor
                                  : const Color(0xFFCBD5E1),
                              width: 1.5,
                            ),
                          ),
                          child: isSelected
                              ? const Icon(
                                  Icons.check,
                                  size: 14,
                                  color: Colors.white,
                                )
                              : null,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}

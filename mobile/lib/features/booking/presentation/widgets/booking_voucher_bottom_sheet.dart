import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class BookingVoucher {
  final String code;
  final String title;
  final String description;
  final int discountAmount;
  final int minOrderAmount;
  final bool isFreeShipping;
  final String expiredDate;

  const BookingVoucher({
    required this.code,
    required this.title,
    required this.description,
    required this.discountAmount,
    this.minOrderAmount = 0,
    this.isFreeShipping = false,
    this.expiredDate = '31/12/2026',
  });
}

const List<BookingVoucher> kAvailableVouchers = [
  BookingVoucher(
    code: 'LAMBE30K',
    title: 'Giảm 30.000đ',
    description: 'Áp dụng cho đơn dịch vụ từ 100.000đ',
    discountAmount: 30000,
    minOrderAmount: 100000,
    expiredDate: '30/11/2026',
  ),
  BookingVoucher(
    code: 'FREESHIP',
    title: 'Miễn phí di chuyển',
    description: 'Miễn phí 100% phí đi lại của chuyên viên',
    discountAmount: 0,
    isFreeShipping: true,
    expiredDate: '31/12/2026',
  ),
  BookingVoucher(
    code: 'LAMBE50K',
    title: 'Giảm 50.000đ Bạn mới',
    description: 'Ưu đãi dành riêng cho đơn dịch vụ từ 200.000đ',
    discountAmount: 50000,
    minOrderAmount: 200000,
    expiredDate: '15/12/2026',
  ),
];

class BookingVoucherBottomSheet extends StatefulWidget {
  final int servicePrice;
  final int travelFee;
  final BookingVoucher? currentVoucher;
  final ValueChanged<BookingVoucher?> onVoucherSelected;

  const BookingVoucherBottomSheet({
    super.key,
    required this.servicePrice,
    required this.travelFee,
    this.currentVoucher,
    required this.onVoucherSelected,
  });

  static void show(
    BuildContext context, {
    required int servicePrice,
    required int travelFee,
    BookingVoucher? currentVoucher,
    required ValueChanged<BookingVoucher?> onVoucherSelected,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BookingVoucherBottomSheet(
        servicePrice: servicePrice,
        travelFee: travelFee,
        currentVoucher: currentVoucher,
        onVoucherSelected: onVoucherSelected,
      ),
    );
  }

  @override
  State<BookingVoucherBottomSheet> createState() => _BookingVoucherBottomSheetState();
}

class _BookingVoucherBottomSheetState extends State<BookingVoucherBottomSheet> {
  final TextEditingController _promoInputController = TextEditingController();
  late BookingVoucher? _selectedVoucher;

  @override
  void initState() {
    super.initState();
    _selectedVoucher = widget.currentVoucher;
  }

  @override
  void dispose() {
    _promoInputController.dispose();
    super.dispose();
  }

  void _applyVoucher(BookingVoucher voucher, NumberFormat currencyFormatter) {
    if (widget.servicePrice < voucher.minOrderAmount) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Đơn hàng chưa đạt mức tối thiểu ${currencyFormatter.format(voucher.minOrderAmount)} để áp dụng mã này.',
          ),
          backgroundColor: const Color(0xFFBA1A1A),
        ),
      );
      return;
    }

    setState(() {
      _selectedVoucher = voucher;
    });
    widget.onVoucherSelected(voucher);
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đã áp dụng mã ưu đãi ${voucher.code}'),
        backgroundColor: const Color(0xFF0F766E),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    return Container(
      height: MediaQuery.of(context).size.height * 0.72,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Drag indicator
          const SizedBox(height: 10),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFFCBD5E1),
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          const SizedBox(height: 12),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(
                      Icons.local_offer_rounded,
                      size: 19,
                      color: Color(0xFFEA580C),
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Ưu đãi & Voucher LamBe',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          // Promo code input box
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _promoInputController,
                    textCapitalization: TextCapitalization.characters,
                    style: const TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                    decoration: InputDecoration(
                      hintText: 'Nhập mã ưu đãi (VD: LAMBE30K)',
                      hintStyle: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.normal,
                        color: Color(0xFF94A3B8),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                      prefixIcon: const Icon(
                        Icons.confirmation_num_outlined,
                        size: 18,
                        color: Color(0xFF64748B),
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide:
                            const BorderSide(color: Color(0xFF0F766E), width: 1.5),
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () {
                    final code = _promoInputController.text.trim().toUpperCase();
                    if (code.isEmpty) return;

                    final matched = kAvailableVouchers.cast<BookingVoucher?>().firstWhere(
                          (v) => v?.code == code,
                          orElse: () => null,
                        );

                    if (matched != null) {
                      _applyVoucher(matched, currencyFormatter);
                    } else {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Mã "$code" không hợp lệ hoặc đã hết hạn'),
                          backgroundColor: const Color(0xFFBA1A1A),
                        ),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 13,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    elevation: 0,
                  ),
                  child: const Text(
                    'Áp dụng',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Voucher List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
              itemCount: kAvailableVouchers.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (ctx, index) {
                final voucher = kAvailableVouchers[index];
                final isSelected = _selectedVoucher?.code == voucher.code;
                final isEligible = widget.servicePrice >= voucher.minOrderAmount;

                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? const Color(0xFFFFF7ED)
                        : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected
                          ? const Color(0xFFEA580C)
                          : (isEligible
                              ? const Color(0xFFE2E8F0)
                              : const Color(0xFFF1F5F9)),
                      width: isSelected ? 1.5 : 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF0F172A).withValues(alpha: 0.02),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      // Icon ticket
                      Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: isEligible
                              ? const Color(0xFFEA580C).withValues(alpha: 0.1)
                              : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          voucher.isFreeShipping
                              ? Icons.local_shipping_outlined
                              : Icons.confirmation_num_rounded,
                          size: 22,
                          color: isEligible
                              ? const Color(0xFFEA580C)
                              : const Color(0xFF94A3B8),
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
                                  voucher.code,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: isEligible
                                        ? const Color(0xFF0F172A)
                                        : const Color(0xFF94A3B8),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 5,
                                    vertical: 1,
                                  ),
                                  decoration: BoxDecoration(
                                    color: isEligible
                                        ? const Color(0xFFFEF3C7)
                                        : const Color(0xFFF1F5F9),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    voucher.title,
                                    style: TextStyle(
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.bold,
                                      color: isEligible
                                          ? const Color(0xFF92400E)
                                          : const Color(0xFF94A3B8),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 3),
                            Text(
                              voucher.description,
                              style: TextStyle(
                                fontSize: 11,
                                color: isEligible
                                    ? const Color(0xFF64748B)
                                    : const Color(0xFF94A3B8),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'HSD: ${voucher.expiredDate}',
                              style: const TextStyle(
                                fontSize: 10,
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Action button
                      if (isSelected)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEA580C),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'Đang dùng',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                        )
                      else
                        OutlinedButton(
                          onPressed: isEligible
                              ? () => _applyVoucher(voucher, currencyFormatter)
                              : null,
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 6,
                            ),
                            side: BorderSide(
                              color: isEligible
                                  ? const Color(0xFF0F766E)
                                  : const Color(0xFFCBD5E1),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          child: Text(
                            isEligible ? 'Dùng ngay' : 'Chưa đủ',
                            style: TextStyle(
                              fontSize: 11.5,
                              fontWeight: FontWeight.bold,
                              color: isEligible
                                  ? const Color(0xFF0F766E)
                                  : const Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

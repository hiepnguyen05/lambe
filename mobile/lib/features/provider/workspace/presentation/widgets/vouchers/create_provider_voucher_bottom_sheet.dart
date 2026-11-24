import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

import '../../../di/provider_workspace_providers.dart';

class CreateProviderVoucherBottomSheet extends ConsumerStatefulWidget {
  const CreateProviderVoucherBottomSheet({super.key});

  static Future<bool?> show(BuildContext context) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const CreateProviderVoucherBottomSheet(),
    );
  }

  @override
  ConsumerState<CreateProviderVoucherBottomSheet> createState() =>
      _CreateProviderVoucherBottomSheetState();
}

class _CreateProviderVoucherBottomSheetState
    extends ConsumerState<CreateProviderVoucherBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  final _valueController = TextEditingController();
  final _maxDiscountController = TextEditingController();
  final _minOrderController = TextEditingController(text: '100000');
  final _usageLimitController = TextEditingController(text: '50');

  String _discountType = 'PERCENTAGE'; // 'PERCENTAGE' | 'FIXED_AMOUNT'
  int _validityDays = 30;

  @override
  void dispose() {
    _codeController.dispose();
    _valueController.dispose();
    _maxDiscountController.dispose();
    _minOrderController.dispose();
    _usageLimitController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final code = _codeController.text.trim().toUpperCase();
    final value = int.parse(_valueController.text.trim());
    final maxDiscount = _discountType == 'PERCENTAGE'
        ? int.tryParse(_maxDiscountController.text.trim())
        : null;
    final minOrder = int.tryParse(_minOrderController.text.trim()) ?? 0;
    final usageLimit = int.tryParse(_usageLimitController.text.trim()) ?? 50;

    final now = DateTime.now();
    final startsAt = now;
    final endsAt = now.add(Duration(days: _validityDays));

    final success = await ref
        .read(providerVouchersNotifierProvider.notifier)
        .createVoucher(
          code: code,
          discountType: _discountType,
          value: value,
          maxDiscountAmount: maxDiscount,
          minOrderAmount: minOrder,
          startsAt: startsAt,
          endsAt: endsAt,
          usageLimit: usageLimit,
        );

    if (mounted) {
      if (success) {
        Navigator.of(context).pop(true);
        AppDialog.success(
          context,
          message: '🎉 Đã tạo mã ưu đãi $code thành công!',
        );
      } else {
        final error =
            ref.read(providerVouchersNotifierProvider).errorMessage ??
            'Không thể tạo mã voucher.';
        AppDialog.error(context, message: error);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(providerVouchersNotifierProvider);
    final isSubmitting = state.isSubmitting;

    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Row(
                  children: [
                    Icon(
                      Icons.local_offer_rounded,
                      color: Color(0xFF0F766E),
                      size: 24,
                    ),
                    SizedBox(width: 10),
                    Text(
                      'Tạo mã ưu đãi cho dịch vụ',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                const Text(
                  'Mã voucher của thợ giảm tối đa 30% giá dịch vụ để tri ân hoặc thu hút khách hàng mới.',
                  style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 16),

                // Mã code
                TextFormField(
                  controller: _codeController,
                  textCapitalization: TextCapitalization.characters,
                  decoration: InputDecoration(
                    labelText: 'Mã ưu đãi (VD: LAMBE10, TRIAN20)',
                    hintText: 'Nhập từ 4-32 ký tự viết hoa...',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    prefixIcon: const Icon(Icons.qr_code_rounded, size: 20),
                  ),
                  validator: (v) {
                    if (v == null || v.trim().length < 4) {
                      return 'Mã voucher phải có ít nhất 4 ký tự.';
                    }
                    if (!RegExp(r'^[A-Z0-9_-]{4,32}$')
                        .hasMatch(v.trim().toUpperCase())) {
                      return 'Mã chỉ bao gồm chữ in hoa, số, dấu gạch nối.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 14),

                // Loại giảm giá (Selector)
                Row(
                  children: [
                    Expanded(
                      child: ChoiceChip(
                        label: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.percent_rounded, size: 16),
                            SizedBox(width: 6),
                            Text('Theo phần trăm (%)'),
                          ],
                        ),
                        selected: _discountType == 'PERCENTAGE',
                        onSelected: (selected) {
                          if (selected) {
                            setState(() => _discountType = 'PERCENTAGE');
                          }
                        },
                        selectedColor: const Color(0xFFCCFBF1),
                        labelStyle: TextStyle(
                          color: _discountType == 'PERCENTAGE'
                              ? const Color(0xFF0F766E)
                              : const Color(0xFF64748B),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ChoiceChip(
                        label: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.money_rounded, size: 16),
                            SizedBox(width: 6),
                            Text('Số tiền cố định (đ)'),
                          ],
                        ),
                        selected: _discountType == 'FIXED_AMOUNT',
                        onSelected: (selected) {
                          if (selected) {
                            setState(() => _discountType = 'FIXED_AMOUNT');
                          }
                        },
                        selectedColor: const Color(0xFFCCFBF1),
                        labelStyle: TextStyle(
                          color: _discountType == 'FIXED_AMOUNT'
                              ? const Color(0xFF0F766E)
                              : const Color(0xFF64748B),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Giá trị giảm & Tối đa
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _valueController,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: _discountType == 'PERCENTAGE'
                              ? 'Mức giảm (%)'
                              : 'Số tiền giảm (đ)',
                          hintText: _discountType == 'PERCENTAGE'
                              ? 'Tối đa 30%'
                              : 'VD: 30000',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        validator: (v) {
                          final val = int.tryParse(v?.trim() ?? '');
                          if (val == null || val <= 0) {
                            return 'Vui lòng nhập giá trị hợp lệ.';
                          }
                          if (_discountType == 'PERCENTAGE' && val > 30) {
                            return 'Thợ chỉ giảm tối đa 30%.';
                          }
                          return null;
                        },
                      ),
                    ),
                    if (_discountType == 'PERCENTAGE') ...[
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _maxDiscountController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Giảm tối đa (đ)',
                            hintText: 'VD: 50000',
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          validator: (v) {
                            final val = int.tryParse(v?.trim() ?? '');
                            if (val == null || val <= 0) {
                              return 'Nhập trần giảm giá.';
                            }
                            return null;
                          },
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 14),

                // Điều kiện tối thiểu & Giới hạn lượt dùng
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _minOrderController,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Đơn tối thiểu (đ)',
                          hintText: 'VD: 100000',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        validator: (v) {
                          final val = int.tryParse(v?.trim() ?? '');
                          if (val == null || val < 0) {
                            return 'Nhập số tiền hợp lệ.';
                          }
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _usageLimitController,
                        keyboardType: TextInputType.number,
                        decoration: InputDecoration(
                          labelText: 'Số lượt dùng',
                          hintText: 'VD: 50',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        validator: (v) {
                          final val = int.tryParse(v?.trim() ?? '');
                          if (val == null || val <= 0) {
                            return 'Tối thiểu 1 lượt.';
                          }
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Thời hạn hiệu lực
                DropdownButtonFormField<int>(
                  initialValue: _validityDays,
                  decoration: InputDecoration(
                    labelText: 'Thời hạn áp dụng mã',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    prefixIcon: const Icon(
                      Icons.calendar_month_rounded,
                      size: 20,
                    ),
                  ),
                  items: const [
                    DropdownMenuItem(value: 7, child: Text('7 ngày (1 tuần)')),
                    DropdownMenuItem(
                      value: 14,
                      child: Text('14 ngày (2 tuần)'),
                    ),
                    DropdownMenuItem(
                      value: 30,
                      child: Text('30 ngày (1 tháng)'),
                    ),
                    DropdownMenuItem(
                      value: 60,
                      child: Text('60 ngày (2 tháng)'),
                    ),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _validityDays = val);
                  },
                ),
                const SizedBox(height: 20),

                // Button submit
                SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: isSubmitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0F766E),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text(
                            'Kích hoạt mã ưu đãi',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

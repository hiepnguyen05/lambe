import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

import '../../../di/provider_income_providers.dart';
import '../../screens/qr_payment_screen.dart';
import '../../screens/sepay_payment_screen.dart';

enum TopupPaymentMethod { sepay, momo }

class TopupBottomSheet extends ConsumerStatefulWidget {
  final String initialAmount;

  const TopupBottomSheet({super.key, this.initialAmount = '200.000'});

  @override
  ConsumerState<TopupBottomSheet> createState() => _TopupBottomSheetState();
}

class _TopupBottomSheetState extends ConsumerState<TopupBottomSheet> {
  // Tạm ẩn tính năng chuyển khoản ngân hàng SePay trên giao diện
  static const bool _isSepayEnabled = false;

  late TextEditingController _controller;
  TopupPaymentMethod _selectedMethod = TopupPaymentMethod.momo;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialAmount);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _setAmount(String amount) {
    setState(() {
      _controller.text = amount;
    });
  }

  void _confirmTopup() async {
    final amountStr = _controller.text.replaceAll('.', '').replaceAll(',', '');
    final amount = double.tryParse(amountStr);

    // Quy chuẩn tailieuUI: 1.000 đến 50.000.000 VND
    if (amount == null || amount < 1000 || amount > 50000000) {
      AppDialog.warning(
        context,
        message: 'Số tiền nạp phải từ 1.000 đ đến 50.000.000 đ.',
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    final notifier = ref.read(providerWalletNotifierProvider.notifier);

    if (_selectedMethod == TopupPaymentMethod.sepay) {
      final topUp = await notifier.createSepayTopUp(amount);
      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });

      if (topUp != null) {
        Navigator.of(context).pop();
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => SepayPaymentScreen(
              topUp: topUp,
              amountFormatted: _controller.text,
            ),
          ),
        );
      } else {
        _showErrorDialog();
      }
    } else {
      final topUp = await notifier.createMomoTopUp(amount);
      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });

      if (topUp != null &&
          (topUp.payUrl != null ||
              topUp.qrCodeUrl != null ||
              topUp.deeplink != null)) {
        Navigator.of(context).pop();
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => QrPaymentScreen(
              topUp: topUp,
              amountFormatted: _controller.text,
            ),
          ),
        );
      } else {
        _showErrorDialog();
      }
    }
  }

  void _showErrorDialog() {
    final errorMsg =
        ref.read(providerWalletNotifierProvider).error ??
        'Không thể tạo giao dịch. Vui lòng thử lại sau.';
    AppDialog.error(context, message: errorMsg);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: colorScheme.primary.withAlpha(25),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.account_balance_wallet_outlined,
                      color: colorScheme.primary,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Nạp tiền Ví nhận đơn',
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                  ),
                ],
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.close),
                style: IconButton.styleFrom(
                  backgroundColor: colorScheme.surfaceContainer,
                  foregroundColor: colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          Text(
            'Số tiền muốn nạp (VNĐ)',
            style: theme.textTheme.labelMedium?.copyWith(
              color: colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),

          Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    keyboardType: TextInputType.number,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
                Text(
                  'đ',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: colorScheme.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Nút chọn nhanh mệnh giá
          Row(
            children: [
              Expanded(child: _buildQuickButton('100.000', context)),
              const SizedBox(width: 8),
              Expanded(
                child: _buildQuickButton('200.000', context, isPrimary: true),
              ),
              const SizedBox(width: 8),
              Expanded(child: _buildQuickButton('500.000', context)),
            ],
          ),
          const SizedBox(height: 20),

          // Chọn phương thức thanh toán
          Text(
            'CHỌN PHƯƠNG THỨC THANH TOÁN',
            style: theme.textTheme.labelSmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 10),

          if (_isSepayEnabled) ...[
            // Phương thức 1: SePay VietQR (Ngân hàng)
            _buildMethodCard(
              context,
              method: TopupPaymentMethod.sepay,
              title: 'Chuyển khoản SePay',
              subtitle: 'Quét mã VietQR chuyển tiền 24/7',
              badge: 'Tự động',
              leadingWidget: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  Icons.account_balance,
                  color: Colors.blue.shade700,
                  size: 20,
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],

          // Phương thức 2: MoMo
          _buildMethodCard(
            context,
            method: TopupPaymentMethod.momo,
            title: 'Ví điện tử MoMo',
            subtitle: 'Quét mã MoMo hoặc mở ứng dụng MoMo',
            badge: 'Phổ biến',
            leadingWidget: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFA50064).withAlpha(20),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Center(
                child: Text(
                  'M',
                  style: TextStyle(
                    color: Color(0xFFA50064),
                    fontWeight: FontWeight.bold,
                    fontSize: 20,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),

          ElevatedButton.icon(
            onPressed: _isLoading ? null : _confirmTopup,
            icon: _isLoading
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colorScheme.onPrimary,
                    ),
                  )
                : const Icon(Icons.lock_outline, size: 20),
            label: Text(
              _isLoading
                  ? 'Đang kết nối cổng thanh toán...'
                  : (_selectedMethod == TopupPaymentMethod.sepay
                        ? 'TIẾP TỤC VỚI SEPAY'
                        : 'TIẾP TỤC VỚI MOMO'),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: colorScheme.primary,
              foregroundColor: colorScheme.onPrimary,
              padding: const EdgeInsets.symmetric(vertical: 14),
              textStyle: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.bold,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
              ),
              elevation: 0,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMethodCard(
    BuildContext context, {
    required TopupPaymentMethod method,
    required String title,
    required String subtitle,
    required String badge,
    required Widget leadingWidget,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;
    final isSelected = _selectedMethod == method;

    return InkWell(
      onTap: () {
        setState(() {
          _selectedMethod = method;
        });
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected
              ? colorScheme.primary.withAlpha(15)
              : colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected
                ? colorScheme.primary
                : colorScheme.outlineVariant.withAlpha(60),
            width: isSelected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            leadingWidget,
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: colorScheme.onSurface,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? colorScheme.primary.withAlpha(30)
                              : colorScheme.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          badge,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: isSelected
                                ? colorScheme.primary
                                : colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colorScheme.onSurfaceVariant,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              isSelected ? Icons.check_circle : Icons.radio_button_unchecked,
              color: isSelected
                  ? colorScheme.primary
                  : colorScheme.outlineVariant,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickButton(
    String label,
    BuildContext context, {
    bool isPrimary = false,
  }) {
    final colorScheme = Theme.of(context).colorScheme;

    return InkWell(
      onTap: () => _setAmount(label),
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isPrimary
              ? colorScheme.primary
              : colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(4),
        ),
        alignment: Alignment.center,
        child: Text(
          '$label đ',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: isPrimary
                ? colorScheme.onPrimary
                : colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}

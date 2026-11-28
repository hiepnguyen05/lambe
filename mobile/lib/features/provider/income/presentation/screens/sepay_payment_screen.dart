import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/core/widgets/order_countdown.dart';

import '../../domain/entities/topup_response_entity.dart';
import '../widgets/topup/sepay_payment_cards.dart';
import '../widgets/topup/top_up_polling_mixin.dart';

class SepayPaymentScreen extends ConsumerStatefulWidget {
  final TopUpResponseEntity topUp;
  final String amountFormatted;

  const SepayPaymentScreen({
    super.key,
    required this.topUp,
    required this.amountFormatted,
  });

  @override
  ConsumerState<SepayPaymentScreen> createState() => _SepayPaymentScreenState();
}

class _SepayPaymentScreenState extends ConsumerState<SepayPaymentScreen>
    with WidgetsBindingObserver, TopUpPollingMixin<SepayPaymentScreen> {
  @override
  void initState() {
    super.initState();
    initTopUpPolling(widget.topUp);
  }

  @override
  void dispose() {
    disposeTopUpPolling();
    super.dispose();
  }

  Future<void> _openSepayCheckout() async {
    final urlStr = currentTopUp.payUrl;
    if (urlStr == null || urlStr.isEmpty) {
      AppDialog.warning(
        context,
        message: 'Không tìm thấy liên kết thanh toán SePay.',
      );
      return;
    }

    final uri = Uri.parse(urlStr);
    try {
      final launched = await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
      if (!launched) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (!mounted) return;
      AppDialog.error(context, message: 'Không thể mở liên kết: $e');
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    HapticFeedback.lightImpact();
    AppDialog.success(context, message: 'Đã sao chép $label!');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        title: const Text('Thanh toán qua SePay'),
        centerTitle: true,
        actions: [
          IconButton(
            icon: isCheckingTopUp
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colorScheme.primary,
                    ),
                  )
                : const Icon(Icons.refresh),
            tooltip: 'Làm mới trạng thái',
            onPressed: isCheckingTopUp ? null : () => checkTopUpStatus(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Trạng thái thanh toán
              SepayStatusHeader(topUp: currentTopUp),
              const SizedBox(height: 20),

              // Thông tin giao dịch Card
              if (currentTopUp.expiresAt != null && currentTopUp.isPending)
                OrderCountdown(
                  deadline: currentTopUp.expiresAt!,
                  onExpired: () => checkTopUpStatus(),
                  builder: (context, remaining) => SepayTransactionCard(
                    topUp: currentTopUp,
                    amountFormatted: widget.amountFormatted,
                    remainingTime: remaining,
                    onCopy: _copyToClipboard,
                  ),
                )
              else
                SepayTransactionCard(
                  topUp: currentTopUp,
                  amountFormatted: widget.amountFormatted,
                  remainingTime: Duration.zero,
                  onCopy: _copyToClipboard,
                ),
              const SizedBox(height: 20),

              // Hành động thanh toán
              if (currentTopUp.isPending) ...[
                ElevatedButton.icon(
                  onPressed: _openSepayCheckout,
                  icon: const Icon(Icons.open_in_new, size: 20),
                  label: const Text('MỞ CỔNG THANH TOÁN SEPAY'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colorScheme.primary,
                    foregroundColor: colorScheme.onPrimary,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    textStyle: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 0,
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: isCheckingTopUp ? null : () => checkTopUpStatus(),
                  icon: isCheckingTopUp
                      ? SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: colorScheme.primary,
                          ),
                        )
                      : const Icon(Icons.check_circle_outline, size: 20),
                  label: Text(
                    isCheckingTopUp
                        ? 'Đang kiểm tra...'
                        : 'TÔI ĐÃ CHUYỂN KHOẢN (KIỂM TRA NGAY)',
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colorScheme.primary,
                    side: BorderSide(color: colorScheme.primary),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    textStyle: theme.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ] else if (currentTopUp.isSucceeded) ...[
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                  },
                  icon: const Icon(Icons.done_all, size: 20),
                  label: const Text('HOÀN TẤT & QUAY VỀ VÍ'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    textStyle: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ] else ...[
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.of(context).pop();
                  },
                  icon: const Icon(Icons.arrow_back, size: 20),
                  label: const Text('QUAY LẠI TẠO YÊU CẦU MỚI'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colorScheme.error,
                    foregroundColor: colorScheme.onError,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ],

              const SizedBox(height: 28),

              // Hướng dẫn chuyển khoản
              const SepayInstructionCard(),
            ],
          ),
        ),
      ),
    );
  }
}

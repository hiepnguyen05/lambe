import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/core/widgets/order_countdown.dart';

import '../../di/provider_income_providers.dart';
import '../../domain/entities/topup_response_entity.dart';
import '../widgets/topup/sepay_payment_cards.dart';

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
    with WidgetsBindingObserver {
  static const _pollIntervals = [
    Duration(seconds: 3),
    Duration(seconds: 5),
    Duration(seconds: 10),
  ];

  late TopUpResponseEntity _currentTopUp;
  Timer? _pollingTimer;
  bool _isChecking = false;
  bool _isPolling = false;
  bool _isForeground = true;
  int _pollIntervalIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _currentTopUp = widget.topUp;
    _schedulePoll();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (_isForeground == foreground) return;
    _isForeground = foreground;
    _pollingTimer?.cancel();
    if (foreground && _currentTopUp.isPending) {
      _pollIntervalIndex = 0;
      unawaited(_refreshAfterResume());
    }
  }

  Future<void> _refreshAfterResume() async {
    await _checkStatus(isAuto: true);
    _schedulePoll();
  }

  void _schedulePoll() {
    _pollingTimer?.cancel();
    if (!mounted || !_isForeground || !_currentTopUp.isPending) return;
    _pollingTimer = Timer(_pollIntervals[_pollIntervalIndex], () async {
      if (!mounted || !_isForeground || !_currentTopUp.isPending) return;
      if (_isPolling || _isChecking) {
        _schedulePoll();
        return;
      }
      _isPolling = true;
      try {
        await _checkStatus(isAuto: true);
      } finally {
        _isPolling = false;
      }
      if (_pollIntervalIndex < _pollIntervals.length - 1) {
        _pollIntervalIndex++;
      }
      _schedulePoll();
    });
  }

  Future<void> _checkStatus({bool isAuto = false}) async {
    if (!isAuto) {
      setState(() {
        _isChecking = true;
      });
    }

    try {
      final updated = await ref
          .read(providerWalletNotifierProvider.notifier)
          .checkTopUpStatus(_currentTopUp.id);

      if (!mounted || updated == null) return;

      setState(() {
        _currentTopUp = updated;
      });

      if (updated.isSucceeded) {
        _pollingTimer?.cancel();
        // Tải lại số dư ví và lịch sử giao dịch
        ref.read(providerWalletNotifierProvider.notifier).loadWalletData();
      } else if (updated.isFailed || updated.isExpired) {
        _pollingTimer?.cancel();
      }
    } finally {
      if (mounted && !isAuto) {
        setState(() {
          _isChecking = false;
        });
      }
    }
  }

  Future<void> _openSepayCheckout() async {
    final urlStr = _currentTopUp.payUrl;
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
            icon: _isChecking
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
            onPressed: _isChecking ? null : () => _checkStatus(),
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
              SepayStatusHeader(topUp: _currentTopUp),
              const SizedBox(height: 20),

              // Thông tin giao dịch Card
              if (_currentTopUp.expiresAt != null && _currentTopUp.isPending)
                OrderCountdown(
                  deadline: _currentTopUp.expiresAt!,
                  onExpired: () => _checkStatus(),
                  builder: (context, remaining) => SepayTransactionCard(
                    topUp: _currentTopUp,
                    amountFormatted: widget.amountFormatted,
                    remainingTime: remaining,
                    onCopy: _copyToClipboard,
                  ),
                )
              else
                SepayTransactionCard(
                  topUp: _currentTopUp,
                  amountFormatted: widget.amountFormatted,
                  remainingTime: Duration.zero,
                  onCopy: _copyToClipboard,
                ),
              const SizedBox(height: 20),

              // Hành động thanh toán
              if (_currentTopUp.isPending) ...[
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
                  onPressed: _isChecking ? null : () => _checkStatus(),
                  icon: _isChecking
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
                    _isChecking
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
              ] else if (_currentTopUp.isSucceeded) ...[
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

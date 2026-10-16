import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../di/provider_income_providers.dart';
import '../../domain/entities/topup_response_entity.dart';

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

class _SepayPaymentScreenState extends ConsumerState<SepayPaymentScreen> {
  late TopUpResponseEntity _currentTopUp;
  Timer? _pollingTimer;
  Timer? _countdownTimer;
  Duration _remainingTime = Duration.zero;
  bool _isChecking = false;

  @override
  void initState() {
    super.initState();
    _currentTopUp = widget.topUp;
    _initCountdown();
    _startPolling();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _initCountdown() {
    if (_currentTopUp.expiresAt != null) {
      final diff = _currentTopUp.expiresAt!.difference(DateTime.now());
      _remainingTime = diff.isNegative ? Duration.zero : diff;

      _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) return;
        if (_remainingTime.inSeconds <= 1) {
          timer.cancel();
          setState(() {
            _remainingTime = Duration.zero;
          });
          _checkStatus();
        } else {
          setState(() {
            _remainingTime = _remainingTime - const Duration(seconds: 1);
          });
        }
      });
    }
  }

  void _startPolling() {
    // Poll every 3 seconds according to tailieuUI spec
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (timer) async {
      if (!mounted) return;
      await _checkStatus(isAuto: true);
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
        _countdownTimer?.cancel();
        // Tải lại số dư ví và lịch sử giao dịch
        ref.read(providerWalletNotifierProvider.notifier).loadWalletData();
      } else if (updated.isFailed || updated.isExpired) {
        _pollingTimer?.cancel();
        _countdownTimer?.cancel();
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
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Không tìm thấy liên kết thanh toán SePay.')),
      );
      return;
    }

    final uri = Uri.parse(urlStr);
    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.inAppBrowserView,
      );
      if (!launched) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Không thể mở liên kết: $e')),
      );
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    HapticFeedback.lightImpact();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Đã sao chép $label!'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
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
              _buildStatusHeader(context),
              const SizedBox(height: 20),

              // Thông tin giao dịch Card
              _buildTransactionCard(context),
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
                  label: Text(_isChecking
                      ? 'Đang kiểm tra...'
                      : 'TÔI ĐÃ CHUYỂN KHOẢN (KIỂM TRA NGAY)'),
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
              _buildInstructions(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatusHeader(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    if (_currentTopUp.isSucceeded) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.green.shade50,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.green.shade200),
        ),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: Colors.green.shade600,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check, color: Colors.white, size: 36),
            ),
            const SizedBox(height: 12),
            Text(
              'Nạp tiền thành công!',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: Colors.green.shade900,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Số tiền đã được cộng vào Ví nhận đơn của bạn.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: Colors.green.shade800,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    if (_currentTopUp.isFailed || _currentTopUp.isExpired) {
      final isExp = _currentTopUp.isExpired;
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: colorScheme.errorContainer.withAlpha(80),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colorScheme.error.withAlpha(100)),
        ),
        child: Column(
          children: [
            Icon(isExp ? Icons.timer_off_outlined : Icons.error_outline,
                color: colorScheme.error, size: 48),
            const SizedBox(height: 12),
            Text(
              isExp ? 'Giao dịch đã hết hạn' : 'Giao dịch thất bại',
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: colorScheme.error,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _currentTopUp.resultMessage ??
                  (isExp
                      ? 'Thời gian chờ thanh toán đã quá hạn. Vui lòng tạo giao dịch mới.'
                      : 'Không thể xác nhận giao dịch. Vui lòng thử lại.'),
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colorScheme.onErrorContainer,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    // PENDING_PAYMENT
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: colorScheme.primaryContainer.withAlpha(70),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.primary.withAlpha(50)),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              color: colorScheme.primary,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Đang chờ chuyển khoản...',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: colorScheme.primary,
                  ),
                ),
                Text(
                  'Hệ thống tự động cộng tiền sau khi nhận giao dịch',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionCard(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final minutes = _remainingTime.inMinutes;
    final seconds = _remainingTime.inSeconds % 60;
    final timeStr = '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant.withAlpha(80)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Số tiền nạp',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              if (_currentTopUp.isPending && _remainingTime.inSeconds > 0)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade100,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.timer_outlined, size: 14, color: Colors.amber.shade900),
                      const SizedBox(width: 4),
                      Text(
                        timeStr,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${widget.amountFormatted} đ',
            style: theme.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.bold,
              color: colorScheme.primary,
            ),
          ),
          const Divider(height: 28),
          
          _buildInfoRow(
            context,
            label: 'Mã đơn hàng / Nội dung',
            value: _currentTopUp.orderId,
            showCopy: true,
          ),
          const SizedBox(height: 12),
          _buildInfoRow(
            context,
            label: 'Cổng thanh toán',
            value: 'SePay (VietQR Sandbox)',
          ),
          const SizedBox(height: 12),
          _buildInfoRow(
            context,
            label: 'Phương thức',
            value: 'Chuyển khoản Ngân hàng 24/7',
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(
    BuildContext context, {
    required String label,
    required String value,
    bool showCopy = false,
  }) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
        ),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: colorScheme.onSurface,
              ),
            ),
            if (showCopy) ...[
              const SizedBox(width: 6),
              InkWell(
                onTap: () => _copyToClipboard(value, label),
                borderRadius: BorderRadius.circular(4),
                child: Padding(
                  padding: const EdgeInsets.all(4.0),
                  child: Icon(Icons.copy, size: 16, color: colorScheme.primary),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }

  Widget _buildInstructions(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colorScheme.outlineVariant.withAlpha(50)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.info_outline, size: 20, color: colorScheme.primary),
              const SizedBox(width: 8),
              Text(
                'Hướng dẫn thanh toán SePay',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: colorScheme.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildInstructionStep(
            context,
            step: '1',
            text: 'Nhấn nút "Mở cổng thanh toán SePay" để hiển thị mã VietQR ngân hàng.',
          ),
          const SizedBox(height: 8),
          _buildInstructionStep(
            context,
            step: '2',
            text: 'Dùng ứng dụng ngân hàng bất kỳ để quét mã VietQR và xác nhận chuyển khoản.',
          ),
          const SizedBox(height: 8),
          _buildInstructionStep(
            context,
            step: '3',
            text: 'Sau khi chuyển khoản thành công, hệ thống SePay tự động cộng tiền trong 5-10 giây.',
          ),
        ],
      ),
    );
  }

  Widget _buildInstructionStep(BuildContext context, {required String step, required String text}) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(
            color: colorScheme.primary.withAlpha(25),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            step,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: colorScheme.primary,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: theme.textTheme.bodySmall?.copyWith(
              color: colorScheme.onSurfaceVariant,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}

import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:gal/gal.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/core/widgets/order_countdown.dart';

import '../../domain/entities/topup_response_entity.dart';
import '../widgets/topup/sepay_payment_cards.dart';
import '../widgets/topup/top_up_polling_mixin.dart';

class QrPaymentScreen extends ConsumerStatefulWidget {
  final TopUpResponseEntity topUp;
  final String amountFormatted;

  const QrPaymentScreen({
    super.key,
    required this.topUp,
    required this.amountFormatted,
  });

  @override
  ConsumerState<QrPaymentScreen> createState() => _QrPaymentScreenState();
}

class _QrPaymentScreenState extends ConsumerState<QrPaymentScreen>
    with WidgetsBindingObserver, TopUpPollingMixin<QrPaymentScreen> {
  final GlobalKey _qrKey = GlobalKey();
  bool _isSaving = false;

  String get _qrData =>
      currentTopUp.qrCodeUrl?.isNotEmpty == true
          ? currentTopUp.qrCodeUrl!
          : (currentTopUp.payUrl ?? currentTopUp.deeplink ?? '');

  String? get _launchTarget {
    final deep = currentTopUp.deeplink;
    if (deep != null && deep.isNotEmpty) return deep;
    final pay = currentTopUp.payUrl;
    if (pay != null && pay.isNotEmpty) return pay;
    return null;
  }

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

  Future<void> _openMomoApp() async {
    final target = _launchTarget;
    if (target == null) {
      AppDialog.warning(
        context,
        message: 'Không tìm thấy liên kết mở ứng dụng MoMo.',
      );
      return;
    }

    try {
      final uri = Uri.parse(target);
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched && currentTopUp.payUrl != null) {
        await launchUrl(
          Uri.parse(currentTopUp.payUrl!),
          mode: LaunchMode.inAppBrowserView,
        );
      }
    } catch (e) {
      if (!mounted) return;
      AppDialog.error(context, message: 'Không thể mở MoMo: $e');
    }
  }

  Future<void> _saveQrToGallery() async {
    setState(() {
      _isSaving = true;
    });

    try {
      final renderObject = _qrKey.currentContext?.findRenderObject();
      if (renderObject is! RenderRepaintBoundary) {
        if (!mounted) return;
        AppDialog.error(context, message: 'Mã QR chưa sẵn sàng để lưu.');
        return;
      }

      final ui.Image image = await renderObject.toImage(pixelRatio: 3.0);
      final ByteData? byteData = await image.toByteData(
        format: ui.ImageByteFormat.png,
      );
      if (byteData == null) {
        if (!mounted) return;
        AppDialog.error(context, message: 'Không thể xuất ảnh mã QR.');
        return;
      }
      final Uint8List pngBytes = byteData.buffer.asUint8List();

      await Gal.putImageBytes(
        pngBytes,
        name: 'lambe_momo_${DateTime.now().millisecondsSinceEpoch}',
      );

      if (!mounted) return;
      AppDialog.success(context, message: 'Đã lưu mã QR vào thư viện ảnh!');
    } catch (e) {
      if (!mounted) return;
      AppDialog.error(context, message: 'Lỗi khi lưu ảnh: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return Scaffold(
      backgroundColor: colorScheme.surface,
      appBar: AppBar(
        title: const Text('Thanh toán nạp ví'),
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
            tooltip: 'Kiểm tra trạng thái',
            onPressed: isCheckingTopUp ? null : () => checkTopUpStatus(),
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: const Color(0xFFA50064),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'M',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    'Nạp tiền qua Ví MoMo',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: colorScheme.onSurface,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SepayStatusHeader(
                topUp: currentTopUp,
                pendingTitle: 'Đang chờ thanh toán MoMo...',
              ),
              const SizedBox(height: 16),
              Text(
                'Số tiền: ${widget.amountFormatted} đ',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: colorScheme.primary,
                ),
              ),
              if (currentTopUp.expiresAt != null && currentTopUp.isPending) ...[
                const SizedBox(height: 6),
                OrderCountdown(
                  deadline: currentTopUp.expiresAt!,
                  onExpired: () => checkTopUpStatus(),
                  builder: (context, remaining) {
                    final mm = remaining.inMinutes
                        .remainder(60)
                        .toString()
                        .padLeft(2, '0');
                    final ss = remaining.inSeconds
                        .remainder(60)
                        .toString()
                        .padLeft(2, '0');
                    return Text(
                      'Hết hạn sau: $mm:$ss',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    );
                  },
                ),
              ],
              if (currentTopUp.isPending && _qrData.isNotEmpty) ...[
                const SizedBox(height: 24),
                Center(
                  child: RepaintBoundary(
                    key: _qrKey,
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: colorScheme.shadow.withAlpha(20),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: QrImageView(
                        data: _qrData,
                        version: QrVersions.auto,
                        size: 240.0,
                        backgroundColor: Colors.white,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                if (_launchTarget != null) ...[
                  ElevatedButton.icon(
                    onPressed: _openMomoApp,
                    icon: const Icon(Icons.open_in_new, size: 20),
                    label: const Text('MỞ ỨNG DỤNG MOMO'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFA50064),
                      foregroundColor: Colors.white,
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
                  const SizedBox(height: 12),
                ],
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
                        : 'TÔI ĐÃ THANH TOÁN (KIỂM TRA NGAY)',
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colorScheme.primary,
                    side: BorderSide(color: colorScheme.primary),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    textStyle: theme.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  onPressed: _isSaving ? null : _saveQrToGallery,
                  icon: _isSaving
                      ? SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: colorScheme.onPrimary,
                          ),
                        )
                      : const Icon(Icons.download, size: 20),
                  label: Text(_isSaving ? 'Đang lưu...' : 'LƯU MÃ QR'),
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
              ] else if (currentTopUp.isSucceeded) ...[
                const SizedBox(height: 32),
                ElevatedButton.icon(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.done_all, size: 20),
                  label: const Text('HOÀN TẤT & QUAY VỀ VÍ'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green.shade600,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).pop(),
                icon: const Icon(Icons.arrow_back, size: 20),
                label: const Text('QUAY LẠI'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: colorScheme.onSurfaceVariant,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  textStyle: theme.textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(24),
                  ),
                  side: BorderSide(color: colorScheme.outlineVariant),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:gal/gal.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

class QrPaymentScreen extends StatefulWidget {
  final String qrData;
  final String amount;

  const QrPaymentScreen({
    super.key,
    required this.qrData,
    required this.amount,
  });

  @override
  State<QrPaymentScreen> createState() => _QrPaymentScreenState();
}

class _QrPaymentScreenState extends State<QrPaymentScreen> {
  final GlobalKey _qrKey = GlobalKey();
  bool _isSaving = false;

  Future<void> _saveQrToGallery() async {
    setState(() {
      _isSaving = true;
    });

    try {
      // Chụp ảnh từ RepaintBoundary
      RenderRepaintBoundary boundary =
          _qrKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
      ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      ByteData? byteData = await image.toByteData(
        format: ui.ImageByteFormat.png,
      );
      final Uint8List pngBytes = byteData!.buffer.asUint8List();

      // Lưu vào thư viện ảnh
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
      appBar: AppBar(title: const Text('Thanh toán nạp ví'), centerTitle: true),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: CachedNetworkImage(
                      imageUrl:
                          'https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png',
                      width: 32,
                      height: 32,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(
                        width: 32,
                        height: 32,
                        color: const Color(0xFFA50064),
                        child: const Icon(
                          Icons.account_balance_wallet_rounded,
                          size: 18,
                          color: Colors.white,
                        ),
                      ),
                      errorWidget: (context, url, error) => Container(
                        width: 32,
                        height: 32,
                        color: const Color(0xFFA50064),
                        child: const Icon(
                          Icons.account_balance_wallet_rounded,
                          size: 18,
                          color: Colors.white,
                        ),
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
              Text(
                'Số tiền: ${widget.amount} đ',
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: colorScheme.primary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Thời gian tạo: ${_formatCurrentTime()}',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 32),
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
                      data: widget.qrData,
                      version: QrVersions.auto,
                      size: 250.0,
                      backgroundColor: Colors.white,
                      embeddedImage: const NetworkImage(
                        'https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png',
                      ),
                      embeddedImageStyle: const QrEmbeddedImageStyle(
                        size: Size(40, 40),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 48),
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

  String _formatCurrentTime() {
    final now = DateTime.now();
    return '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')} ${now.day.toString().padLeft(2, '0')}/${now.month.toString().padLeft(2, '0')}/${now.year}';
  }
}

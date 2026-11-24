import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class ProviderOrderEvidenceInspection extends StatefulWidget {
  final Map<String, dynamic> order;
  final bool isActionLoading;
  final Future<bool> Function(String type) onUploadEvidence;
  final VoidCallback onProceedToSettlement;
  final VoidCallback onBackToTimer;
  final Widget? addOnsSection;

  const ProviderOrderEvidenceInspection({
    super.key,
    required this.order,
    required this.isActionLoading,
    required this.onUploadEvidence,
    required this.onProceedToSettlement,
    required this.onBackToTimer,
    this.addOnsSection,
  });

  @override
  State<ProviderOrderEvidenceInspection> createState() =>
      _ProviderOrderEvidenceInspectionState();
}

class _ProviderOrderEvidenceInspectionState
    extends State<ProviderOrderEvidenceInspection> {
  void _showImageDialog(BuildContext context, String imageUrl, String title) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.of(ctx).pop(),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.network(
                imageUrl,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Container(
                  color: Colors.white,
                  padding: const EdgeInsets.all(24),
                  child: const Text('Không thể tải ảnh'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final evidenceList = (widget.order['evidence'] as List<dynamic>?) ?? [];
    final beforeEvidence = evidenceList.firstWhere(
      (e) => e['type'] == 'BEFORE_WORK',
      orElse: () => null,
    );
    final afterEvidence = evidenceList.firstWhere(
      (e) => e['type'] == 'AFTER_WORK',
      orElse: () => null,
    );

    final beforeUrl = beforeEvidence?['filePath']?.toString();
    final afterUrl = afterEvidence?['filePath']?.toString();
    final hasBeforeWork = beforeEvidence != null;
    final hasAfterWork = afterEvidence != null;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [
        if (widget.addOnsSection != null) widget.addOnsSection!,
        Row(
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: widget.onBackToTimer,
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.arrow_back_ios_new_rounded,
                        size: 14,
                        color: AppColors.primary,
                      ),
                      SizedBox(width: 6),
                      Text(
                        'Quay lại đồng hồ đếm giờ',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x08000000),
                blurRadius: 12,
                offset: Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.compare_rounded,
                    size: 20,
                    color: AppColors.primary,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Ảnh trước và sau dịch vụ',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF6E7977),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Trước khi làm',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF64748B),
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (beforeUrl != null && beforeUrl.isNotEmpty)
                          GestureDetector(
                            onTap: () => _showImageDialog(
                              context,
                              beforeUrl,
                              'Ảnh trước khi làm (BEFORE)',
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(14),
                              child: Stack(
                                children: [
                                  Image.network(
                                    beforeUrl,
                                    height: 140,
                                    width: double.infinity,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Container(
                                      height: 140,
                                      color: const Color(0xFFF1F5F9),
                                      child: const Icon(
                                        Icons.broken_image,
                                        color: Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    bottom: 6,
                                    right: 6,
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(
                                          alpha: 0.6,
                                        ),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Icon(
                                        Icons.zoom_in,
                                        size: 16,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        else if (hasBeforeWork)
                          const _EvidencePreviewUnavailable(
                            label: 'Ảnh trước đã tải lên',
                          )
                        else
                          Container(
                            height: 140,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(
                                color: const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: const Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.image_not_supported_outlined,
                                    size: 28,
                                    color: Color(0xFF94A3B8),
                                  ),
                                  SizedBox(height: 4),
                                  Text(
                                    'Chưa có ảnh trước',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFF94A3B8),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),

                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Kết quả sau khi làm',
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        if (afterUrl != null && afterUrl.isNotEmpty)
                          GestureDetector(
                            onTap: () => _showImageDialog(
                              context,
                              afterUrl,
                              'Ảnh kết quả thành phẩm (AFTER)',
                            ),
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(14),
                              child: Stack(
                                children: [
                                  Image.network(
                                    afterUrl,
                                    height: 140,
                                    width: double.infinity,
                                    fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) => Container(
                                      height: 140,
                                      color: const Color(0xFFF1F5F9),
                                      child: const Icon(
                                        Icons.broken_image,
                                        color: Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    top: 6,
                                    right: 6,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF16A34A),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: const Text(
                                        'Đã tải lên',
                                        style: TextStyle(
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    bottom: 6,
                                    right: 6,
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withValues(
                                          alpha: 0.6,
                                        ),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Icon(
                                        Icons.zoom_in,
                                        size: 16,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        else if (hasAfterWork)
                          const _EvidencePreviewUnavailable(
                            label: 'Ảnh kết quả đã tải lên',
                          )
                        else
                          InkWell(
                            borderRadius: BorderRadius.circular(14),
                            onTap: () => widget.onUploadEvidence('AFTER_WORK'),
                            child: Container(
                              height: 140,
                              decoration: BoxDecoration(
                                color: const Color(0xFFEFF6F5),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: AppColors.primaryContainer,
                                  width: 1.5,
                                ),
                              ),
                              child: const Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.add_a_photo_rounded,
                                      size: 32,
                                      color: AppColors.primary,
                                    ),
                                    SizedBox(height: 6),
                                    Text(
                                      'Chụp ảnh ngay',
                                      style: TextStyle(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.primary,
                                      ),
                                    ),
                                    SizedBox(height: 2),
                                    Text(
                                      'Bắt buộc',
                                      style: TextStyle(
                                        fontSize: 10,
                                        color: Color(0xFF6E7977),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),

        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                Icons.lightbulb_outline_rounded,
                size: 20,
                color: Color(0xFFD97706),
              ),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Chụp ảnh đủ sáng, rõ nét và thể hiện trọn vẹn kết quả dịch vụ.',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFF475569),
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton.icon(
            onPressed: (hasAfterWork && !widget.isActionLoading)
                ? widget.onProceedToSettlement
                : null,
            icon: const Icon(Icons.arrow_forward_rounded, size: 20),
            label: Text(
              hasAfterWork
                  ? 'Tiếp tục xác nhận thanh toán'
                  : 'Cần chụp ảnh thành phẩm trước',
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                letterSpacing: 0,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              disabledBackgroundColor: const Color(0xFFCBD5E1),
              foregroundColor: Colors.white,
              disabledForegroundColor: Colors.white,
              elevation: hasAfterWork ? 3 : 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
        const SizedBox(height: 40),
      ],
    );
  }
}

class _EvidencePreviewUnavailable extends StatelessWidget {
  final String label;

  const _EvidencePreviewUnavailable({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 140,
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.check_circle_outline_rounded,
              color: Color(0xFF15803D),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF166534),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

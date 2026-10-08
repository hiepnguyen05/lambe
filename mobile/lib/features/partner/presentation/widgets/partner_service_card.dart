import 'package:flutter/material.dart';

import '../../../../core/utils/app_dialogs.dart';
import '../models/partner_service_form_model.dart';
import '../utils/currency_utils.dart';

class PartnerServiceCard extends StatelessWidget {
  final PartnerServiceFormModel service;
  final VoidCallback onToggleExpand;
  final VoidCallback onSave;

  const PartnerServiceCard({
    super.key,
    required this.service,
    required this.onToggleExpand,
    required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    final isExpanded = service.isExpanded;
    final minPrice = service.minPrice;
    final maxPrice = service.maxPrice;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isExpanded ? const Color(0xFF0F766E) : const Color(0xFFF3F4F6),
          width: isExpanded ? 1.5 : 1,
        ),
        boxShadow: isExpanded
            ? [
                BoxShadow(
                  color: const Color(0xFF0F766E).withValues(alpha: 0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ]
            : [],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: onToggleExpand,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 22,
                    height: 22,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: isExpanded
                            ? const Color(0xFF0F766E)
                            : const Color(0xFFD1D5DB),
                        width: 1.5,
                      ),
                      color: isExpanded
                          ? const Color(0xFF0F766E)
                          : Colors.transparent,
                    ),
                    child: isExpanded
                        ? const Icon(Icons.edit, size: 14, color: Colors.white)
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          service.name,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: isExpanded
                                ? const Color(0xFF0B1C30)
                                : const Color(0xFF374151),
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          service.category,
                          style: const TextStyle(
                            color: Color(0xFF6B7280),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (isExpanded)
                    const Icon(
                      Icons.keyboard_arrow_up,
                      size: 20,
                      color: Color(0xFF0F766E),
                    )
                  else
                    const Icon(
                      Icons.keyboard_arrow_down,
                      size: 20,
                      color: Color(0xFF9CA3AF),
                    ),
                ],
              ),
            ),
          ),
          if (isExpanded) ...[
            const Divider(height: 1, color: Color(0xFFF3F4F6)),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  // Giá đề xuất
                  Row(
                    children: [
                      const Text(
                        'Giá đề xuất (đ)',
                        style: TextStyle(
                          fontWeight: FontWeight.w500,
                          fontSize: 14,
                          color: Color(0xFF4B5563),
                        ),
                      ),
                      const SizedBox(width: 6),
                      if (minPrice != null || maxPrice != null)
                        GestureDetector(
                          onTap: () {
                            AppDialogs.showMessageDialog(
                              context,
                              title: 'Gợi ý giá',
                              message:
                                  'Giá sàn: ${minPrice ?? 0}đ\nGiá trần: ${maxPrice ?? 'Không giới hạn'}đ\n\nVui lòng đặt giá trong khoảng này.',
                            );
                          },
                          child: const Icon(
                            Icons.info_outline,
                            size: 16,
                            color: Color(0xFF0F766E),
                          ),
                        ),
                      const Spacer(),
                      SizedBox(
                        width: 110,
                        child: TextFormField(
                          controller: service.priceController,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F766E),
                            fontSize: 15,
                          ),
                          decoration: InputDecoration(
                            isDense: true,
                            hintText: 'Nhập giá',
                            hintStyle: const TextStyle(
                              color: Color(0xFF9CA3AF),
                              fontSize: 13,
                              fontWeight: FontWeight.normal,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(
                                color: Color(0xFFE5E7EB),
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(
                                color: Color(0xFF0F766E),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: service.priceController,
                    builder: (context, value, child) {
                      final text = numberToVietnameseText(value.text);
                      if (text.isEmpty) return const SizedBox.shrink();
                      return Align(
                        alignment: Alignment.centerRight,
                        child: Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            text,
                            style: const TextStyle(
                              color: Color(0xFF0F766E),
                              fontSize: 13,
                              fontStyle: FontStyle.italic,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  // Thời gian
                  Row(
                    children: [
                      const Text(
                        'Thời gian (phút)',
                        style: TextStyle(
                          fontWeight: FontWeight.w500,
                          fontSize: 14,
                          color: Color(0xFF4B5563),
                        ),
                      ),
                      const Spacer(),
                      SizedBox(
                        width: 110,
                        child: TextFormField(
                          controller: service.durationController,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.right,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF374151),
                            fontSize: 15,
                          ),
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 8,
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(
                                color: Color(0xFFE5E7EB),
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(8),
                              borderSide: const BorderSide(
                                color: Color(0xFF0F766E),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  // Mô tả riêng
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Mô tả dịch vụ của bạn (không bắt buộc)',
                        style: TextStyle(
                          fontWeight: FontWeight.w500,
                          fontSize: 13,
                          color: Color(0xFF4B5563),
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: service.descriptionController,
                        maxLines: 2,
                        style: const TextStyle(
                          fontSize: 14,
                          color: Color(0xFF374151),
                        ),
                        decoration: InputDecoration(
                          hintText:
                              'Nhập mô tả riêng về cách bạn làm dịch vụ này...',
                          hintStyle: const TextStyle(
                            color: Color(0xFF9CA3AF),
                            fontSize: 13,
                            fontWeight: FontWeight.normal,
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 10,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFFE5E7EB),
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFF0F766E),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Nút Lưu / Xong
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        final price = service.priceController.text.trim();
                        final duration = service.durationController.text.trim();
                        if (price.isEmpty || int.tryParse(price) == null) {
                          AppDialogs.showErrorDialog(
                            context,
                            message: 'Vui lòng nhập giá hợp lệ.',
                          );
                          return;
                        }
                        if (duration.isEmpty ||
                            int.tryParse(duration) == null ||
                            int.tryParse(duration)! <= 0) {
                          AppDialogs.showErrorDialog(
                            context,
                            message: 'Vui lòng nhập thời gian hợp lệ.',
                          );
                          return;
                        }

                        final priceNum = int.tryParse(price)!;
                        if (minPrice != null && priceNum < minPrice) {
                          AppDialogs.showErrorDialog(
                            context,
                            message:
                                'Giá đề xuất không được thấp hơn ${minPrice.toString()}đ.',
                          );
                          return;
                        }
                        if (maxPrice != null && priceNum > maxPrice) {
                          AppDialogs.showErrorDialog(
                            context,
                            message:
                                'Giá đề xuất không được cao hơn ${maxPrice.toString()}đ.',
                          );
                          return;
                        }
                        // Thành công
                        onSave();
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F766E),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      child: const Text(
                        'Lưu thông tin',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class ServiceDetailOverviewCard extends StatelessWidget {
  final String title;
  final String? description;
  final int minPriceAmount;
  final List<String> tags;

  const ServiceDetailOverviewCard({
    super.key,
    required this.title,
    this.description,
    required this.minPriceAmount,
    this.tags = const ['Phục vụ tận nơi', 'Chuyên viên xác minh tay nghề', 'An toàn & Chu đáo'],
  });

  String _formatPrice(int amount) {
    return NumberFormat.decimalPattern('vi_VN').format(amount);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.03),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Tiêu đề dịch vụ
            Text(
              title,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0B1C30),
                height: 1.25,
                letterSpacing: -0.3,
              ),
            ),

            if (description != null && description!.trim().isNotEmpty) ...[
              const SizedBox(height: 10),
              // Mô tả căn lề 2 bên (justify)
              Text(
                description!,
                textAlign: TextAlign.justify,
                style: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFF64748B),
                  height: 1.5,
                ),
              ),
            ],

            const SizedBox(height: 16),

            // Dòng giá dịch vụ: "Giá chỉ từ: 180.000đ" (đã bỏ phần kềm tiệt trùng)
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                const Text(
                  'Giá chỉ từ: ',
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF64748B),
                  ),
                ),
                Text(
                  '${_formatPrice(minPriceAmount)}đ',
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF0F766E),
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 16),

            // Các thẻ cam kết dịch vụ (Tags)
            if (tags.isNotEmpty)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: tags.map((tag) {
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.check_circle_rounded,
                          size: 14,
                          color: Color(0xFF0F766E),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          tag,
                          style: const TextStyle(
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF334155),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
          ],
        ),
      ),
    );
  }
}

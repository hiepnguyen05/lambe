import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';

class ProviderOrderDestinationCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final VoidCallback? onNavigate;

  const ProviderOrderDestinationCard({
    super.key,
    required this.order,
    this.onNavigate,
  });

  @override
  Widget build(BuildContext context) {
    final addressLine =
        order['addressLine']?.toString() ?? 'Chưa cập nhật địa chỉ';
    final streetLine = order['addressStreetLine']?.toString();
    final wardName = order['addressWardName']?.toString();
    final districtName = order['addressDistrictName']?.toString();
    final provinceName = order['addressProvinceName']?.toString();
    final addressNote = order['addressNote']?.toString();
    final customerNote = order['customerNote']?.toString();

    final fullSubAddress = [
      if (wardName != null && wardName.isNotEmpty) wardName,
      if (districtName != null && districtName.isNotEmpty) districtName,
      if (provinceName != null && provinceName.isNotEmpty) provinceName,
    ].join(', ');

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Địa chỉ đến',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF6E7977),
            ),
          ),
          const SizedBox(height: 6),

          Text(
            streetLine != null && streetLine.isNotEmpty
                ? streetLine
                : addressLine,
            style: const TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0B1C30),
            ),
          ),

          if (fullSubAddress.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              fullSubAddress,
              style: const TextStyle(
                fontSize: 12.5,
                color: Color(0xFF64748B),
                fontWeight: FontWeight.w500,
              ),
            ),
          ],

          if (onNavigate != null) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: onNavigate,
                icon: const Icon(Icons.directions_rounded, size: 18),
                label: const Text(
                  'Chỉ đường Google Maps',
                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.primary,
                  side: const BorderSide(color: Color(0xFF99F6E4)),
                  backgroundColor: const Color(0xFFF0FDFA),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ),
          ],

          if ((addressNote != null && addressNote.isNotEmpty) ||
              (customerNote != null && customerNote.isNotEmpty)) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (addressNote != null && addressNote.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        'Chỉ dẫn: $addressNote',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF334155),
                          height: 1.4,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  if (customerNote != null && customerNote.isNotEmpty)
                    Text(
                      'Ghi chú: $customerNote',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF334155),
                        height: 1.4,
                        fontWeight: FontWeight.w600,
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

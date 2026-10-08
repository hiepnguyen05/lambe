import 'package:flutter/material.dart';

import '../models/partner_service_form_model.dart';

class PartnerCompactSelectedCard extends StatelessWidget {
  final PartnerServiceFormModel service;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  const PartnerCompactSelectedCard({
    super.key,
    required this.service,
    required this.onEdit,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final priceStr = service.priceController.text;
    final formattedPrice = priceStr.isNotEmpty
        ? '${int.parse(priceStr).toString().replaceAll(RegExp(r'\\B(?=(\\d{3})+(?!\\d))'), '.')}đ'
        : 'Chưa có giá';
    final durationStr = service.durationController.text;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F766E).withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: const Color(0xFF0F766E).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  service.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F766E),
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$formattedPrice • $durationStr phút',
                  style: const TextStyle(
                    color: Color(0xFF4B5563),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.edit, size: 18, color: Color(0xFF0F766E)),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: onEdit,
          ),
          const SizedBox(width: 16),
          IconButton(
            icon: const Icon(Icons.close, size: 18, color: Colors.redAccent),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}

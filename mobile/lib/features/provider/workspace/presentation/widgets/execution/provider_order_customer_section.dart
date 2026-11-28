import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_peer_entity.dart';

/// Displays customer contact info with quick call and chat actions on provider order detail.
class ProviderOrderCustomerSection extends StatelessWidget {
  final Map<String, dynamic> order;
  final void Function(String phone) onCall;

  const ProviderOrderCustomerSection({
    super.key,
    required this.order,
    required this.onCall,
  });

  @override
  Widget build(BuildContext context) {
    final customer = (order['customer'] as Map?) ?? {};
    final customerId = customer['id']?.toString() ?? '';
    final customerName =
        order['contactName']?.toString() ??
        customer['fullName']?.toString() ??
        'Khách hàng';
    final phone =
        order['contactPhone']?.toString() ??
        customer['phone']?.toString() ??
        '';
    final avatarUrl = customer['avatarUrl']?.toString();
    final orderId = order['id']?.toString() ?? '';
    final shortOrderId = orderId.length > 8
        ? orderId.substring(0, 8).toUpperCase()
        : orderId;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              width: 46,
              height: 46,
              color: const Color(0xFFEFF6F5),
              child: avatarUrl != null && avatarUrl.startsWith('http')
                  ? Image.network(
                      avatarUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.person_rounded,
                        color: AppColors.primary,
                        size: 24,
                      ),
                    )
                  : const Icon(
                      Icons.person_rounded,
                      color: AppColors.primary,
                      size: 24,
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customerName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                  ),
                ),
                const SizedBox(height: 2),
                const Text(
                  'Khách hàng đặt lịch',
                  style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          if (phone.isNotEmpty) ...[
            const SizedBox(width: 6),
            _CircleContactButton(
              icon: Icons.call_rounded,
              onTap: () => onCall(phone),
            ),
          ],
          if (customerId.isNotEmpty) ...[
            const SizedBox(width: 8),
            _CircleContactButton(
              icon: Icons.chat_bubble_rounded,
              onTap: () => context.push(
                '/chat/room',
                extra: {
                  'peer': ChatPeerEntity(
                    id: customerId,
                    displayName: customerName,
                    avatarUrl: avatarUrl,
                  ),
                  'initialText': shortOrderId.isNotEmpty
                      ? 'Chào bạn, mình là chuyên viên phụ trách đơn #$shortOrderId.'
                      : null,
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CircleContactButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _CircleContactButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFEFF6F5),
      shape: const CircleBorder(),
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xFFCCFBF1)),
          ),
          child: Icon(icon, size: 18, color: AppColors.primary),
        ),
      ),
    );
  }
}

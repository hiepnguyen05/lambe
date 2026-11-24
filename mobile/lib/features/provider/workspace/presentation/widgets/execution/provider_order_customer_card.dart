import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_peer_entity.dart';

class ProviderOrderCustomerCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final void Function(String phone) onCall;
  final VoidCallback? onRecordContactAttempt;

  const ProviderOrderCustomerCard({
    super.key,
    required this.order,
    required this.onCall,
    this.onRecordContactAttempt,
  });

  String _formatCurrency(num? amount) {
    if (amount == null) return '0đ';
    final formatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );
    return formatter.format(amount);
  }

  void _openChat(
    BuildContext context,
    Map<String, dynamic> customer,
    String? orderId,
  ) {
    final customerId = customer['id']?.toString() ?? '';
    final customerName = customer['fullName']?.toString() ?? 'Khách hàng';
    final avatarUrl = customer['avatarUrl']?.toString();

    context.push(
      '/chat/room',
      extra: {
        'peer': ChatPeerEntity(
          id: customerId,
          displayName: customerName,
          avatarUrl: avatarUrl,
        ),
        'initialText': orderId != null
            ? 'Chào bạn, mình là kỹ thuật viên phụ trách đơn hẹn #$orderId.'
            : null,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final customer = (order['customer'] as Map<String, dynamic>?) ?? {};
    final customerName =
        order['contactName']?.toString() ??
        customer['fullName']?.toString() ??
        'Khách hàng';
    final phone =
        order['contactPhone']?.toString() ??
        customer['phone']?.toString() ??
        '';
    final avatarUrl = customer['avatarUrl']?.toString();
    final serviceName = order['serviceName']?.toString() ?? 'Dịch vụ';
    final totalAmount =
        (order['totalAmount'] as num?) ?? (order['price'] as num?) ?? 0;
    final orderId = order['id']?.toString() ?? '';
    final shortOrderId = orderId.length > 8
        ? orderId.substring(0, 8).toUpperCase()
        : orderId;

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
          Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: const Color(0xFFEFF4FF),
                backgroundImage: avatarUrl != null && avatarUrl.isNotEmpty
                    ? NetworkImage(avatarUrl)
                    : null,
                child: avatarUrl == null || avatarUrl.isEmpty
                    ? const Icon(
                        Icons.person,
                        size: 24,
                        color: AppColors.primary,
                      )
                    : null,
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
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      phone.isNotEmpty ? phone : 'Chưa có số điện thoại',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),

              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: phone.isNotEmpty
                      ? () {
                          onRecordContactAttempt?.call();
                          onCall(phone);
                        }
                      : null,
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6F5),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFD8E5E2)),
                    ),
                    child: const Icon(
                      Icons.call_rounded,
                      size: 18,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => _openChat(context, customer, shortOrderId),
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6F5),
                      shape: BoxShape.circle,
                      border: Border.all(color: const Color(0xFFD8E5E2)),
                    ),
                    child: const Icon(
                      Icons.chat_bubble_rounded,
                      size: 18,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          const SizedBox(height: 12),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      serviceName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Đơn hẹn #LB-$shortOrderId',
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                _formatCurrency(totalAmount),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

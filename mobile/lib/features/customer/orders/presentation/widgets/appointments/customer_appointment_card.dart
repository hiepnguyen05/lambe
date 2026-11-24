import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/widgets/app_cached_image.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_peer_entity.dart';

import '../../../domain/entities/customer_order_entity.dart';
import '../detail/order_status_badge.dart';

class CustomerAppointmentCard extends StatelessWidget {
  static const _primary = Color(0xFF0F766E);
  static const _muted = Color(0xFF64748B);

  final CustomerOrderEntity order;
  final NumberFormat currencyFormatter;
  final void Function(CustomerOrderEntity order)? onOpenReview;

  const CustomerAppointmentCard({
    super.key,
    required this.order,
    required this.currencyFormatter,
    this.onOpenReview,
  });

  @override
  Widget build(BuildContext context) {
    final detailPath = '/appointments/${order.id}';
    final target = order.isActive ? '$detailPath/tracking' : detailPath;

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(target),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _header(),
              const SizedBox(height: 12),
              _providerSummary(),
              if (order.addressLine?.isNotEmpty == true) ...[
                const SizedBox(height: 10),
                _address(),
              ],
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 10),
                child: Divider(height: 1),
              ),
              _payment(),
              const SizedBox(height: 12),
              _actions(context),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    final asap = order.bookingType == 'ASAP';
    final scheduled = order.scheduledAt == null
        ? 'Đã hẹn trước'
        : DateFormat('HH:mm - dd/MM/yyyy').format(order.scheduledAt!);
    final code = order.id.length > 8
        ? order.id.substring(0, 8).toUpperCase()
        : order.id;

    return Row(
      children: [
        Flexible(
          child: Chip(
            avatar: Icon(
              asap ? Icons.flash_on_rounded : Icons.event_rounded,
              size: 14,
            ),
            label: Text(asap ? 'Đặt ngay (ASAP)' : scheduled),
            visualDensity: VisualDensity.compact,
          ),
        ),
        const SizedBox(width: 6),
        Text(
          '#$code',
          style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
        ),
        const Spacer(),
        OrderStatusBadge(
          status: order.status,
          cancellationStatus: order.cancellationRequest?.status,
        ),
      ],
    );
  }

  Widget _providerSummary() {
    final provider = order.provider;
    final avatarUrl = provider?.avatarUrl;

    return Row(
      children: [
        AppCachedImage.avatar(
          imageUrl: avatarUrl,
          size: 50,
          borderRadius: BorderRadius.circular(12),
          errorWidget: const _AvatarFallback(),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                order.serviceName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 3),
              Row(
                children: [
                  Flexible(
                    child: Text(
                      provider?.displayName ?? 'Chuyên viên Lambe',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (provider?.rating != null) ...[
                    const SizedBox(width: 6),
                    const Icon(
                      Icons.star_rounded,
                      size: 14,
                      color: Color(0xFFF59E0B),
                    ),
                    Text(provider!.rating!.toStringAsFixed(1)),
                  ],
                ],
              ),
              Text(
                'Thời lượng: ${order.durationMinutes} phút',
                style: const TextStyle(fontSize: 11.5, color: _muted),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _address() => DecoratedBox(
    decoration: BoxDecoration(
      color: const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Row(
        children: [
          const Icon(Icons.location_on_outlined, size: 14, color: _muted),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              order.addressLine!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11.5, color: _muted),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _payment() => Row(
    children: [
      const Text('Tổng thanh toán:', style: TextStyle(color: _muted)),
      if (order.voucherCode != null) ...[
        const SizedBox(width: 6),
        Chip(
          label: Text('Voucher ${order.voucherCode}'),
          visualDensity: VisualDensity.compact,
        ),
      ],
      const Spacer(),
      Text(
        currencyFormatter.format(order.totalAmount),
        style: const TextStyle(
          fontSize: 15,
          fontWeight: FontWeight.w800,
          color: _primary,
        ),
      ),
    ],
  );

  Widget _actions(BuildContext context) {
    if (order.isActive) {
      return Row(
        children: [
          _actionButton(
            label: 'Theo dõi trực tiếp',
            icon: Icons.near_me_rounded,
            onPressed: () => context.push('/appointments/${order.id}/tracking'),
          ),
          if (order.provider != null) ...[
            const SizedBox(width: 8),
            IconButton.outlined(
              onPressed: () => _openChat(context),
              icon: const Icon(Icons.chat_bubble_outline_rounded),
              color: _primary,
            ),
          ],
        ],
      );
    }

    if (order.isCompleted) {
      return Row(
        children: [
          if (order.review == null)
            _actionButton(
              label: 'Đánh giá',
              icon: Icons.star_outline_rounded,
              outlined: true,
              color: const Color(0xFFD97706),
              onPressed: onOpenReview == null
                  ? null
                  : () => onOpenReview!(order),
            )
          else
            Expanded(
              child: Center(
                child: Text(
                  '✓ Đã đánh giá (${order.review!.rating}★)',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF15803D),
                  ),
                ),
              ),
            ),
          const SizedBox(width: 8),
          _actionButton(
            label: 'Xem hóa đơn',
            icon: Icons.receipt_long_outlined,
            onPressed: () => context.push('/appointments/${order.id}'),
          ),
        ],
      );
    }

    return Row(
      children: [
        _actionButton(
          label: 'Xem lý do hủy',
          icon: Icons.info_outline_rounded,
          outlined: true,
          color: const Color(0xFFDC2626),
          onPressed: () => context.push('/appointments/${order.id}'),
        ),
        const SizedBox(width: 8),
        _actionButton(
          label: 'Đặt lại dịch vụ',
          icon: Icons.replay_rounded,
          onPressed: () => context.go('/explore'),
        ),
      ],
    );
  }

  Widget _actionButton({
    required String label,
    required IconData icon,
    required VoidCallback? onPressed,
    bool outlined = false,
    Color color = _primary,
  }) {
    final child = Text(label, textAlign: TextAlign.center);
    return Expanded(
      child: outlined
          ? OutlinedButton.icon(
              onPressed: onPressed,
              icon: Icon(icon, size: 16),
              label: child,
              style: OutlinedButton.styleFrom(foregroundColor: color),
            )
          : FilledButton.icon(
              onPressed: onPressed,
              icon: Icon(icon, size: 16),
              label: child,
              style: FilledButton.styleFrom(backgroundColor: color),
            ),
    );
  }

  void _openChat(BuildContext context) {
    final provider = order.provider!;
    context.push(
      '/chat/room',
      extra: {
        'providerId': provider.id,
        'peer': ChatPeerEntity(
          id: provider.id,
          displayName: provider.displayName,
          avatarUrl: provider.avatarUrl,
        ),
      },
    );
  }
}

class _AvatarFallback extends StatelessWidget {
  const _AvatarFallback();

  @override
  Widget build(BuildContext context) => const ColoredBox(
    color: Color(0xFFF1F5F9),
    child: Icon(Icons.person, color: Color(0xFF94A3B8), size: 26),
  );
}

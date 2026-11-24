import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/widgets/app_cached_image.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_peer_entity.dart';

import '../../../domain/entities/customer_order_entity.dart';
import '../detail/order_status_badge.dart';

class CustomerAppointmentCard extends StatelessWidget {
  static const _primary = Color(0xFF0F766E);
  static const _dark = Color(0xFF0F172A);
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

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.push(target),
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(context),
                const SizedBox(height: 14),
                _buildProviderAndService(),
                if (order.addressLine?.isNotEmpty == true) ...[
                  const SizedBox(height: 12),
                  _buildAddressSection(),
                ],
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                ),
                _buildPaymentSummary(),
                const SizedBox(height: 14),
                _buildActionButtons(context),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final isAsap = order.bookingType == 'ASAP';
    final code = order.id.length > 8
        ? order.id.substring(0, 8).toUpperCase()
        : order.id.toUpperCase();

    return Row(
      children: [
        // Badge loại đặt & thời gian
        if (isAsap)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFFFEDD5)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.bolt_rounded,
                  size: 14,
                  color: Color(0xFFEA580C),
                ),
                SizedBox(width: 3),
                Text(
                  'Đặt ngay (ASAP)',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFC2410C),
                  ),
                ),
              ],
            ),
          )
        else
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDFA),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFCCFBF1)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.calendar_today_rounded,
                  size: 12,
                  color: Color(0xFF0F766E),
                ),
                const SizedBox(width: 4),
                Text(
                  order.scheduledAt == null
                      ? 'Đã hẹn trước'
                      : DateFormat('HH:mm • dd/MM/yyyy')
                          .format(order.scheduledAt!),
                  style: const TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F766E),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(width: 8),

        // Mã đơn hàng
        GestureDetector(
          onTap: () {
            Clipboard.setData(ClipboardData(text: order.id));
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Đã sao chép mã đơn hàng'),
                duration: Duration(seconds: 1),
                behavior: SnackBarBehavior.floating,
              ),
            );
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '#$code',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF64748B),
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
          ),
        ),

        const Spacer(),

        // Trạng thái đơn hàng
        OrderStatusBadge(
          status: order.status,
          cancellationStatus: order.cancellationRequest?.status,
        ),
      ],
    );
  }

  Widget _buildProviderAndService() {
    final provider = order.provider;
    final avatarUrl = provider?.avatarUrl;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Ảnh đại diện thợ
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFF1F5F9), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: AppCachedImage.avatar(
            imageUrl: avatarUrl,
            size: 56,
            borderRadius: BorderRadius.circular(14),
            errorWidget: const _AvatarFallback(),
          ),
        ),
        const SizedBox(width: 14),

        // Thông tin dịch vụ & thợ
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                order.serviceName,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: _dark,
                  height: 1.25,
                ),
              ),
              const SizedBox(height: 4),

              Row(
                children: [
                  Flexible(
                    child: Text(
                      provider?.displayName ?? 'Chuyên viên Lambe',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF334155),
                      ),
                    ),
                  ),
                  if (provider?.rating != null) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 1.5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            size: 12,
                            color: Color(0xFFD97706),
                          ),
                          const SizedBox(width: 2),
                          Text(
                            provider!.rating!.toStringAsFixed(1),
                            style: const TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF92400E),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 4),

              // Thời lượng dịch vụ
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.schedule_rounded,
                      size: 11,
                      color: _muted,
                    ),
                    const SizedBox(width: 3),
                    Text(
                      '${order.durationMinutes} phút thực hiện',
                      style: const TextStyle(
                        fontSize: 11,
                        color: _muted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAddressSection() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
    decoration: BoxDecoration(
      color: const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: const Color(0xFFF1F5F9)),
    ),
    child: Row(
      children: [
        const Icon(
          Icons.location_on_outlined,
          size: 15,
          color: _primary,
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            order.addressLine!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF475569),
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _buildPaymentSummary() => Row(
    children: [
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Tổng thanh toán:',
                style: TextStyle(
                  fontSize: 12.5,
                  color: _muted,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (order.voucherCode != null) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.confirmation_number_outlined,
                        size: 11,
                        color: Color(0xFFB45309),
                      ),
                      const SizedBox(width: 2),
                      Text(
                        order.voucherCode!,
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF92400E),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 2),
          Text(
            _paymentMethodLabel(order.paymentMethod),
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF94A3B8),
            ),
          ),
        ],
      ),
      const Spacer(),
      Text(
        currencyFormatter.format(order.totalAmount),
        style: const TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w900,
          color: _primary,
          letterSpacing: -0.2,
        ),
      ),
    ],
  );

  String _paymentMethodLabel(String method) {
    switch (method.toUpperCase()) {
      case 'MOMO':
        return 'Thanh toán ví MoMo';
      case 'SEPAY':
      case 'BANK_TRANSFER':
        return 'Chuyển khoản QR ngân hàng';
      case 'CASH':
      default:
        return 'Tiền mặt khi hoàn thành';
    }
  }

  Widget _buildActionButtons(BuildContext context) {
    if (order.isActive) {
      return Row(
        children: [
          Expanded(
            child: SizedBox(
              height: 42,
              child: FilledButton.icon(
                onPressed: () =>
                    context.push('/appointments/${order.id}/tracking'),
                icon: const Icon(Icons.near_me_rounded, size: 16),
                label: const Text(
                  'Theo dõi trực tiếp',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: _primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
              ),
            ),
          ),
          if (order.provider != null) ...[
            const SizedBox(width: 8),
            SizedBox(
              height: 42,
              child: OutlinedButton.icon(
                onPressed: () => _openChat(context),
                icon: const Icon(
                  Icons.chat_bubble_outline_rounded,
                  size: 16,
                  color: _primary,
                ),
                label: const Text(
                  'Nhắn tin',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: _primary,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Color(0xFFCCFBF1), width: 1.5),
                  backgroundColor: const Color(0xFFF0FDFA),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        ],
      );
    }

    if (order.isCompleted) {
      return Row(
        children: [
          if (order.review == null)
            Expanded(
              child: SizedBox(
                height: 42,
                child: FilledButton.icon(
                  onPressed: onOpenReview == null
                      ? null
                      : () => onOpenReview!(order),
                  icon: const Icon(Icons.star_rounded, size: 16),
                  label: const Text(
                    'Đánh giá dịch vụ',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFD97706),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                  ),
                ),
              ),
            )
          else
            Expanded(
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.verified_rounded,
                        size: 16,
                        color: Color(0xFF16A34A),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Đã đánh giá (${order.review!.rating}★)',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF15803D),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(width: 8),
          Expanded(
            child: SizedBox(
              height: 42,
              child: OutlinedButton.icon(
                onPressed: () => context.push('/appointments/${order.id}'),
                icon: const Icon(Icons.receipt_long_outlined, size: 16),
                label: const Text(
                  'Xem chi tiết',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF334155),
                  side: const BorderSide(color: Color(0xFFE2E8F0)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    }

    // Đã hủy / Đã từ chối
    return Row(
      children: [
        Expanded(
          child: SizedBox(
            height: 42,
            child: FilledButton.icon(
              onPressed: () => context.go('/explore'),
              icon: const Icon(Icons.replay_rounded, size: 16),
              label: const Text(
                'Đặt lại dịch vụ',
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.bold,
                ),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: _primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: 0,
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: SizedBox(
            height: 42,
            child: OutlinedButton.icon(
              onPressed: () => context.push('/appointments/${order.id}'),
              icon: const Icon(Icons.info_outline_rounded, size: 16),
              label: const Text(
                'Xem chi tiết',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                ),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFDC2626),
                side: const BorderSide(color: Color(0xFFFECACA)),
                backgroundColor: const Color(0xFFFEF2F2),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ),
      ],
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
    child: Icon(Icons.person, color: Color(0xFF94A3B8), size: 28),
  );
}

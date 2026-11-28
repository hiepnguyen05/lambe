import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/core/widgets/order_countdown.dart';

import 'package:mobile/core/utils/address_utils.dart';
import 'package:mobile/core/utils/currency_utils.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_peer_entity.dart';

import '../../domain/entities/provider_dashboard_entity.dart';
import '../../application/provider_upcoming_appointments_provider.dart';

class UpcomingAppointmentsSection extends ConsumerWidget {
  const UpcomingAppointmentsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final appointmentsState = ref.watch(providerUpcomingAppointmentsProvider);
    final appointments = appointmentsState.valueOrNull ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 4, bottom: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Row(
                  children: [
                    Flexible(
                      child: Text(
                        'Đơn đặt sắp tới',
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    if (appointments.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          color: colorScheme.primaryContainer,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          '${appointments.length}',
                          style: TextStyle(
                            color: colorScheme.onPrimaryContainer,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              InkWell(
                onTap: () => context.push('/provider/orders'),
                borderRadius: BorderRadius.circular(4),
                child: Text(
                  'Xem tất cả',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        if (appointmentsState.isLoading && !appointmentsState.hasValue)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: LinearProgressIndicator(),
          )
        else if (appointmentsState.hasError)
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Chưa tải được đơn đặt sắp tới'),
            subtitle: const Text('Kiểm tra kết nối rồi thử lại.'),
            trailing: IconButton(
              tooltip: 'Tải lại đơn sắp tới',
              icon: const Icon(Icons.refresh),
              onPressed: () =>
                  ref.invalidate(providerUpcomingAppointmentsProvider),
            ),
          )
        else if (appointments.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Column(
                children: [
                  const Text(
                    'Không có đơn đặt sắp tới',
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () => context.push('/provider/schedule'),
                    icon: const Icon(Icons.calendar_today_rounded, size: 16),
                    label: const Text('Quản lý lịch & Báo bận'),
                  ),
                ],
              ),
            ),
          )
        else
          ...appointments.map(
            (appointment) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: AppointmentCard(appointment: appointment),
            ),
          ),
      ],
    );
  }
}

class AppointmentCard extends ConsumerWidget {
  final ProviderAppointmentEntity appointment;

  const AppointmentCard({super.key, required this.appointment});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    final timeFormat = DateFormat('HH:mm');
    final formattedTime = timeFormat.format(appointment.scheduledTime);
    final isToday = DateUtils.isSameDay(
      appointment.scheduledTime,
      DateTime.now(),
    );
    final timeDisplay = isToday
        ? '$formattedTime hôm nay'
        : '$formattedTime · ${DateFormat('dd/MM/yyyy').format(appointment.scheduledTime)}';

    final formattedPrice = CurrencyUtils.formatVnd(appointment.price);
    final distance = appointment.travelDistanceKm;
    final distanceDisplay = distance == null
        ? 'Chưa có quãng đường'
        : 'Di chuyển ${NumberFormat('0.#', 'vi').format(distance)} km';
    final normalizedAddress = AddressUtils.deduplicate(appointment.address);
    final locationDisplay = normalizedAddress.isNotEmpty
        ? normalizedAddress
        : 'Chưa có địa điểm';
    final customerId = appointment.customerId?.trim();

    Future<void> openDetail() async {
      await context.push('/provider/orders/${appointment.id}');
      if (context.mounted) {
        ref.invalidate(providerUpcomingAppointmentsProvider);
      }
    }

    Future<void> openChat() async {
      if (customerId == null || customerId.isEmpty) return;
      final shortOrderId = appointment.id.length > 8
          ? appointment.id.substring(0, 8).toUpperCase()
          : appointment.id;
      await context.push(
        '/chat/room',
        extra: {
          'peer': ChatPeerEntity(
            id: customerId,
            displayName: appointment.customerName,
            avatarUrl: appointment.customerAvatar.isNotEmpty
                ? appointment.customerAvatar
                : null,
          ),
          'initialText':
              'Chào bạn, mình là kỹ thuật viên phụ trách đơn hẹn #$shortOrderId.',
        },
      );
    }

    return Material(
      color: colorScheme.surface,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: openDetail,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: colorScheme.outlineVariant.withValues(alpha: 0.45),
            ),
            boxShadow: [
              BoxShadow(
                color: colorScheme.primaryContainer.withValues(alpha: 0.04),
                blurRadius: 12,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (appointment.overdueAt != null)
                OrderCountdown(
                  deadline: appointment.scheduledTime,
                  builder: (context, remaining) => remaining == Duration.zero
                      ? Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.warning_amber_rounded,
                                size: 14,
                                color: colorScheme.error,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                'Lịch hẹn đã quá giờ',
                                style: theme.textTheme.labelMedium?.copyWith(
                                  color: colorScheme.error,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        )
                      : const SizedBox.shrink(),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: colorScheme.primary.withValues(
                                alpha: 0.08,
                              ),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.schedule_rounded,
                                  size: 14,
                                  color: colorScheme.primary,
                                ),
                                const SizedBox(width: 5),
                                Flexible(
                                  child: Text(
                                    timeDisplay,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w700,
                                      color: colorScheme.primary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          appointment.serviceName,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          formattedPrice,
                          style: theme.textTheme.titleSmall?.copyWith(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            color: colorScheme.primary,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            Icon(
                              Icons.route_outlined,
                              size: 14,
                              color: colorScheme.onSurfaceVariant,
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                distanceDisplay,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              Icons.location_on_outlined,
                              size: 14.5,
                              color: colorScheme.onSurfaceVariant,
                            ),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                locationDisplay,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w500,
                                  color: colorScheme.onSurfaceVariant,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  SizedBox(
                    width: 96,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _CompactActionButton(
                          icon: Icons.call,
                          label: 'Liên hệ',
                          backgroundColor: colorScheme.surfaceContainerHighest,
                          foregroundColor: colorScheme.onSurface,
                          iconColor: colorScheme.primary,
                          fontWeight: FontWeight.w600,
                          onTap:
                              appointment.contactPhone?.trim().isNotEmpty !=
                                  true
                              ? null
                              : () async {
                                  try {
                                    final opened = await launchUrl(
                                      Uri(
                                        scheme: 'tel',
                                        path: appointment.contactPhone!.trim(),
                                      ),
                                      mode: LaunchMode.externalApplication,
                                    );
                                    if (!opened && context.mounted) {
                                      await AppDialog.info(
                                        context,
                                        message:
                                            'Không mở được ứng dụng gọi điện. Số liên hệ: ${appointment.contactPhone}',
                                      );
                                    }
                                  } catch (_) {
                                    if (context.mounted) {
                                      await AppDialog.info(
                                        context,
                                        message:
                                            'Không mở được ứng dụng gọi điện. Số liên hệ: ${appointment.contactPhone}',
                                      );
                                    }
                                  }
                                },
                        ),
                        const SizedBox(height: 8),
                        _CompactActionButton(
                          icon: Icons.chat_bubble_outline_rounded,
                          label: 'Nhắn tin',
                          backgroundColor: colorScheme.primary,
                          foregroundColor: colorScheme.onPrimary,
                          fontWeight: FontWeight.bold,
                          onTap: customerId?.isNotEmpty == true
                              ? openChat
                              : null,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompactActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color? iconColor;
  final FontWeight fontWeight;
  final VoidCallback? onTap;

  const _CompactActionButton({
    required this.icon,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
    this.iconColor,
    required this.fontWeight,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final disabled = onTap == null;
    final effectiveBg = disabled
        ? backgroundColor.withValues(alpha: 0.45)
        : backgroundColor;
    final effectiveFg = disabled
        ? foregroundColor.withValues(alpha: 0.45)
        : foregroundColor;
    final effectiveIcon = disabled
        ? (iconColor ?? foregroundColor).withValues(alpha: 0.45)
        : (iconColor ?? foregroundColor);

    return Material(
      color: effectiveBg,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          height: 40,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 9),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 14, color: effectiveIcon),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: fontWeight,
                      color: effectiveFg,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

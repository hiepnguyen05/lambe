import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/customer/booking/domain/entities/provider_booking_entry.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/catalog_providers.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';

import '../../domain/feed_post.dart';
import '../../di/feed_providers.dart';

class FeedBookingActions extends ConsumerStatefulWidget {
  final FeedPost post;
  const FeedBookingActions({super.key, required this.post});

  @override
  ConsumerState<FeedBookingActions> createState() => _FeedBookingActionsState();
}

class _FeedBookingActionsState extends ConsumerState<FeedBookingActions> {
  bool _busy = false;

  Future<void> _book(FeedService service) async {
    if (_busy) return;
    final accountId = ref.read(authNotifierProvider).valueOrNull?.id;
    if (accountId == null) return;
    setState(() => _busy = true);
    ref
        .read(feedEngagementReporterProvider)
        .report(widget.post.id, 'OPEN_SERVICE');
    var showUnavailableError = false;
    try {
      final profile = await ref
          .read(partnerProfileRepositoryProvider)
          .getPublicProfile(widget.post.provider.id);
      if (profile.id != widget.post.provider.id) {
        throw StateError('Hồ sơ không khớp.');
      }
      final choices = profile.services.where(
        (v) => v.id == service.id && v.serviceId == service.serviceId,
      );
      if (choices.isEmpty) throw StateError('Dịch vụ không còn khả dụng.');
      final offering = choices.single;
      final catalog = await ref
          .read(catalogRepositoryProvider)
          .getServiceBySlug(offering.slug);
      if (catalog.id != service.serviceId) {
        throw StateError('Dịch vụ không khớp.');
      }
      if (!mounted ||
          ref.read(authNotifierProvider).valueOrNull?.id != accountId) {
        return;
      }
      ref
          .read(feedEngagementReporterProvider)
          .report(widget.post.id, 'START_BOOKING');
      await context.push(
        '/booking/config',
        extra: ProviderBookingEntry(
          service: catalog,
          providerId: profile.id,
          providerServiceId: offering.id,
          providerDisplayName: profile.displayName,
          providerAvatarUrl: profile.avatarUrl,
          priceAmount: offering.priceAmount,
        ),
      );
    } catch (_) {
      showUnavailableError = true;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (showUnavailableError && mounted) {
      await AppDialog.error(
        context,
        message:
            'Dịch vụ vừa thay đổi hoặc chưa khả dụng. Hãy tải lại hồ sơ chuyên viên.',
      );
    }
  }

  IconData _resolveServiceIcon(String name) {
    final lower = name.toLowerCase();
    if (lower.contains('tóc') || lower.contains('cắt')) {
      return Icons.content_cut_rounded;
    }
    if (lower.contains('nail') ||
        lower.contains('móng') ||
        lower.contains('sơn')) {
      return Icons.brush_rounded;
    }
    if (lower.contains('da') || lower.contains('mặt')) {
      return Icons.face_retouching_natural_rounded;
    }
    if (lower.contains('massage') || lower.contains('spa')) {
      return Icons.spa_rounded;
    }
    return Icons.auto_awesome_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final signedIn =
        ref.watch(authNotifierProvider.select((v) => v.valueOrNull?.id)) !=
        null;
    final currencyFormatter = NumberFormat.decimalPattern('vi_VN');
    final services = widget.post.services;

    if (services.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Expanded(
              child: Text(
                'Khám phá dịch vụ & đặt lịch hẹn với chuyên viên',
                style: TextStyle(
                  fontSize: 12.5,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            ),
            TextButton(
              onPressed: () =>
                  context.push('/providers/${widget.post.provider.id}/public'),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                foregroundColor: AppColors.primary,
              ),
              child: const Text('Xem hồ sơ'),
            ),
          ],
        ),
      );
    }

    // 1 Service Attached -> Single Card Style
    if (services.length == 1) {
      final service = services.first;
      final isServiceActive = service.status == 'ACTIVE';
      final canBook = signedIn && !_busy && isServiceActive;

      return Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            // Service Icon Circle
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLowest,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Icon(
                _resolveServiceIcon(service.name),
                size: 20,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 10),

            // Service Name & Price
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    service.name,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13.5,
                      color: AppColors.onSurface,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  RichText(
                    text: TextSpan(
                      text: '${currencyFormatter.format(service.price)}đ',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12.5,
                        color: AppColors.primary,
                      ),
                      children: [
                        if (service.duration != null)
                          TextSpan(
                            text: ' • ${service.duration} phút',
                            style: const TextStyle(
                              fontWeight: FontWeight.normal,
                              fontSize: 11.5,
                              color: AppColors.onSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),

            // Booking Pill Button
            ElevatedButton(
              onPressed: canBook ? () => _book(service) : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                elevation: 0,
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 9,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
              ),
              child: _busy
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Đặt dịch vụ',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ],
        ),
      );
    }

    // Multiple Services Attached (> 1) -> Tray Style
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // List of service rows
          for (int i = 0; i < services.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            InkWell(
              onTap: () => _book(services[i]),
              borderRadius: BorderRadius.circular(8),
              child: Row(
                children: [
                  Icon(
                    _resolveServiceIcon(services[i].name),
                    size: 16,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      services[i].name,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${currencyFormatter.format(services[i].price)}đ',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                      color: AppColors.primary,
                    ),
                  ),
                  if (services[i].duration != null)
                    Text(
                      ' • ${services[i].duration}p',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),

          // Main CTA Button
          ElevatedButton.icon(
            onPressed: () {
              if (services.isNotEmpty) {
                _book(services.first);
              }
            },
            icon: const Icon(Icons.calendar_month_rounded, size: 16),
            label: Text(
              'Đặt dịch vụ (${services.length} dịch vụ)',
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.bold,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 10),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(100),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

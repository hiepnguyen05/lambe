import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../../domain/entities/booking_draft_entity.dart';

class BookingDetailsCards extends StatelessWidget {
  static final _currency = NumberFormat.currency(
    locale: 'vi_VN',
    symbol: 'đ',
    decimalDigits: 0,
  );

  final BookingDraftEntity draft;
  final TextEditingController contactNameController;
  final TextEditingController contactPhoneController;
  final TextEditingController noteController;
  final VoidCallback onChangeProvider;

  const BookingDetailsCards({
    super.key,
    required this.draft,
    required this.contactNameController,
    required this.contactPhoneController,
    required this.noteController,
    required this.onChangeProvider,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _providerCard(),
        const SizedBox(height: 12),
        _serviceCard(),
        const SizedBox(height: 12),
        _contactCard(),
        const SizedBox(height: 12),
        const _SectionCard(
          title: 'Phương thức thanh toán',
          icon: Icons.account_balance_wallet_rounded,
          child: ListTile(
            contentPadding: EdgeInsets.zero,
            leading: CircleAvatar(
              child: Icon(Icons.payments_rounded, color: AppColors.primary),
            ),
            title: Text(
              'Tiền mặt (COD)',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: AppColors.primary,
              ),
            ),
            subtitle: Text(
              'Thanh toán trực tiếp cho chuyên viên sau khi làm xong',
            ),
            trailing: Icon(
              Icons.check_circle_rounded,
              color: AppColors.primary,
            ),
          ),
        ),
      ],
    );
  }

  Widget _providerCard() {
    final avatarUrl = draft.providerAvatarUrl;
    return _SectionCard(
      title: 'Chuyên viên phục vụ',
      icon: Icons.person_pin_rounded,
      trailing: TextButton.icon(
        onPressed: onChangeProvider,
        icon: const Icon(Icons.sync_rounded, size: 14),
        label: const Text('Đổi thợ'),
      ),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: SizedBox(
            width: 52,
            height: 52,
            child: avatarUrl?.startsWith('http') == true
                ? CachedNetworkImage(
                    imageUrl: avatarUrl!,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => const _ProviderFallback(),
                  )
                : const _ProviderFallback(),
          ),
        ),
        title: Text(
          draft.providerDisplayName ?? 'Chuyên viên Lambe',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        subtitle: const Row(
          children: [
            Icon(Icons.verified_rounded, size: 14, color: AppColors.primary),
            SizedBox(width: 4),
            Text('Chuyên viên đối tác đã duyệt'),
          ],
        ),
      ),
    );
  }

  Widget _serviceCard() {
    final asap = draft.bookingType == BookingType.asap;
    final servicePrice =
        draft.providerPriceAmount ?? draft.service.minPriceAmount;
    final scheduleText = draft.scheduledAt == null
        ? 'Hẹn trước'
        : DateFormat(
            'HH:mm - EEEE, dd/MM/yyyy',
            'vi_VN',
          ).format(draft.scheduledAt!);

    return _SectionCard(
      title: 'Thông tin dịch vụ & Thời gian',
      icon: Icons.spa_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  draft.service.name,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              Text(
                _currency.format(servicePrice),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text('Thời lượng: ${draft.service.defaultDurationMinutes} phút'),
          const SizedBox(height: 12),
          DecoratedBox(
            decoration: BoxDecoration(
              color: asap
                  ? AppColors.hotBadgeBg
                  : AppColors.primaryFixed.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: ListTile(
              dense: true,
              leading: Icon(
                asap ? Icons.bolt_rounded : Icons.calendar_month_rounded,
                color: asap ? AppColors.hotBadgeText : AppColors.primary,
              ),
              title: Text(
                asap
                    ? 'Phục vụ làm ngay: chuyên viên di chuyển khi nhận đơn.'
                    : 'Lịch hẹn: $scheduleText',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: asap ? AppColors.hotBadgeText : AppColors.primary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _contactCard() {
    final address =
        draft.selectedAddress?.addressLine ??
        draft.inlineAddress?.addressLine ??
        'Địa chỉ hiện tại của bạn';
    final readOnly = draft.rematchSourceOrderId != null;

    return _SectionCard(
      title: 'Địa chỉ & Người nhận',
      icon: Icons.location_on_rounded,
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.place_outlined,
                size: 18,
                color: AppColors.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  address,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _field(
                  controller: contactNameController,
                  label: 'Người liên hệ',
                  readOnly: readOnly,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _field(
                  controller: contactPhoneController,
                  label: 'Số điện thoại',
                  readOnly: readOnly,
                  keyboardType: TextInputType.phone,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          _field(
            controller: noteController,
            hint: 'Ghi chú cho thợ (số nhà, chuông cửa, ngõ...)',
            readOnly: readOnly,
          ),
        ],
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required bool readOnly,
    String? label,
    String? hint,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      readOnly: readOnly,
      keyboardType: keyboardType,
      style: const TextStyle(fontSize: 13),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        filled: true,
        fillColor: AppColors.surfaceContainerLow,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;
  final Widget? trailing;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: AppColors.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class _ProviderFallback extends StatelessWidget {
  const _ProviderFallback();

  @override
  Widget build(BuildContext context) => const ColoredBox(
    color: AppColors.surfaceContainerLow,
    child: Icon(Icons.person_rounded, color: AppColors.outline),
  );
}

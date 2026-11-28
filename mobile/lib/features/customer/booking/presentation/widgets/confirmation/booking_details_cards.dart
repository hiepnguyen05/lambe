import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/utils/currency_utils.dart';

import '../../../domain/entities/booking_draft_entity.dart';

class BookingDetailsCards extends StatelessWidget {
  static final _currency = CurrencyUtils.vndCurrency;

  final BookingDraftEntity draft;
  final TextEditingController contactNameController;
  final TextEditingController contactPhoneController;
  final TextEditingController noteController;
  final VoidCallback onChangeProvider;
  final ValueChanged<String>? onContactNameChanged;
  final ValueChanged<String>? onContactPhoneChanged;
  final ValueChanged<String>? onNoteChanged;

  const BookingDetailsCards({
    super.key,
    required this.draft,
    required this.contactNameController,
    required this.contactPhoneController,
    required this.noteController,
    required this.onChangeProvider,
    this.onContactNameChanged,
    this.onContactPhoneChanged,
    this.onNoteChanged,
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
        _paymentMethodCard(),
      ],
    );
  }

  Widget _providerCard() {
    final avatarUrl = draft.providerAvatarUrl;
    return _SectionCard(
      title: 'Chuyên viên phục vụ',
      icon: Icons.person_outline_rounded,
      trailing: TextButton.icon(
        onPressed: onChangeProvider,
        icon: const Icon(Icons.sync_rounded, size: 14, color: Color(0xFF0F766E)),
        label: const Text(
          'Đổi thợ',
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F766E),
          ),
        ),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 46,
              height: 46,
              child: avatarUrl?.startsWith('http') == true
                  ? CachedNetworkImage(
                      imageUrl: avatarUrl!,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => const _ProviderFallback(),
                    )
                  : const _ProviderFallback(),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  draft.providerDisplayName ?? 'Chuyên viên Lambe',
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                  ),
                ),
                const SizedBox(height: 3),
                const Row(
                  children: [
                    Icon(
                      Icons.verified_rounded,
                      size: 14,
                      color: Color(0xFF0F766E),
                    ),
                    SizedBox(width: 4),
                    Text(
                      'Chuyên viên đối tác đã xác minh',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
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
      title: 'Dịch vụ & Lịch hẹn',
      icon: Icons.spa_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      draft.service.name,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0B1C30),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Thời lượng: ${draft.service.defaultDurationMinutes} phút',
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                _currency.format(servicePrice),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF0F766E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: asap ? const Color(0xFFFFFBEB) : const Color(0xFFEFF6F5),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: asap
                    ? const Color(0xFFFDE68A)
                    : const Color(0xFF99F6E4).withValues(alpha: 0.6),
              ),
            ),
            child: Row(
              children: [
                Icon(
                  asap ? Icons.bolt_rounded : Icons.calendar_month_rounded,
                  size: 16,
                  color: asap
                      ? const Color(0xFFD97706)
                      : const Color(0xFF0F766E),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    asap
                        ? 'Phục vụ làm ngay (chuyên viên di chuyển khi nhận đơn)'
                        : 'Lịch hẹn: $scheduleText',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: asap
                          ? const Color(0xFF92400E)
                          : const Color(0xFF0F766E),
                    ),
                  ),
                ),
              ],
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
      icon: Icons.location_on_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 2),
                child: Icon(
                  Icons.home_outlined,
                  size: 17,
                  color: Color(0xFF0F766E),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  address,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0B1C30),
                    height: 1.35,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _field(
                  controller: contactNameController,
                  label: 'Người liên hệ',
                  readOnly: readOnly,
                  onChanged: onContactNameChanged,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _field(
                  controller: contactPhoneController,
                  label: 'Số điện thoại',
                  readOnly: readOnly,
                  keyboardType: TextInputType.phone,
                  onChanged: onContactPhoneChanged,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          _field(
            controller: noteController,
            hint: 'Ghi chú cho thợ (chỉ đường, dặn dò...)',
            readOnly: readOnly,
            onChanged: onNoteChanged,
          ),
        ],
      ),
    );
  }

  Widget _paymentMethodCard() {
    return _SectionCard(
      title: 'Phương thức thanh toán',
      icon: Icons.payments_outlined,
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6F5),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.payments_rounded,
              color: Color(0xFF0F766E),
              size: 20,
            ),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Tiền mặt (COD)',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  'Thanh toán trực tiếp cho chuyên viên sau khi làm xong',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.check_circle_rounded,
            color: Color(0xFF0F766E),
            size: 20,
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
    ValueChanged<String>? onChanged,
  }) {
    return TextField(
      controller: controller,
      readOnly: readOnly,
      keyboardType: keyboardType,
      onChanged: onChanged,
      style: const TextStyle(fontSize: 13, color: Color(0xFF0B1C30)),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(fontSize: 11.5, color: Color(0xFF64748B)),
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
        filled: true,
        fillColor: const Color(0xFFF8FAFC),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 10,
          vertical: 9,
        ),
        isDense: true,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFF0F766E), width: 1.5),
        ),
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
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6F5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 16, color: const Color(0xFF0F766E)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0B1C30),
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _ProviderFallback extends StatelessWidget {
  const _ProviderFallback();

  @override
  Widget build(BuildContext context) => Container(
    color: const Color(0xFFEFF6F5),
    child: const Icon(Icons.person_rounded, color: Color(0xFF0F766E)),
  );
}

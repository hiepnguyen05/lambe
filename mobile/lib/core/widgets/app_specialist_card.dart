import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/customer/booking/domain/entities/booking_provider_candidate_entity.dart';
import 'package:mobile/features/customer/catalog/domain/entities/nearby_technician_entity.dart';
import 'package:mobile/features/customer/home/domain/entities/specialist_item.dart';

export 'package:mobile/features/customer/home/domain/entities/specialist_item.dart';

class AppSpecialistCard extends StatelessWidget {
  static final _currency = NumberFormat.decimalPattern('vi_VN');

  final String id;
  final String name;
  final String specialty;
  final String avatarUrl;
  final double? rating;
  final int reviewCount;
  final String distance;
  final int startingPrice;
  final String? priceSuffix;
  final bool isOnline;
  final bool isSelected;
  final String actionText;
  final bool isActionSelected;
  final bool isActionDisabled;
  final String? disabledActionText;
  final VoidCallback? onBookTap;
  final VoidCallback? onCardTap;
  final VoidCallback? onChatTap;
  final Widget? bottomContent;
  final EdgeInsetsGeometry? margin;

  const AppSpecialistCard({
    super.key,
    required this.id,
    required this.name,
    required this.specialty,
    required this.avatarUrl,
    required this.rating,
    this.reviewCount = 0,
    this.distance = '',
    this.startingPrice = 0,
    this.priceSuffix,
    this.isOnline = true,
    this.isSelected = false,
    this.actionText = 'Đặt lịch',
    this.isActionSelected = false,
    this.isActionDisabled = false,
    this.disabledActionText,
    this.onBookTap,
    this.onCardTap,
    this.onChatTap,
    this.bottomContent,
    this.margin,
  });

  factory AppSpecialistCard.fromSpecialistItem({
    Key? key,
    required SpecialistItem specialist,
    String actionText = 'Đặt lịch',
    VoidCallback? onBookTap,
    VoidCallback? onCardTap,
    EdgeInsetsGeometry? margin,
  }) => AppSpecialistCard(
    key: key,
    id: specialist.id,
    name: specialist.name,
    specialty: specialist.specialty,
    avatarUrl: specialist.avatarUrl,
    rating: specialist.rating,
    reviewCount: specialist.reviewCount,
    distance: specialist.distance,
    startingPrice: specialist.startingPrice,
    isOnline: specialist.isOnline,
    actionText: actionText,
    onBookTap: onBookTap,
    onCardTap: onCardTap,
    margin: margin,
  );

  factory AppSpecialistCard.fromNearbyTechnician({
    Key? key,
    required NearbyTechnicianEntity technician,
    String actionText = 'Chọn thợ',
    VoidCallback? onBookTap,
    VoidCallback? onCardTap,
    EdgeInsetsGeometry? margin,
  }) => AppSpecialistCard(
    key: key,
    id: technician.id,
    name: technician.displayName,
    specialty: _specialty(
      technician.badge,
      technician.experienceYears,
      'năm kn',
    ),
    avatarUrl: technician.avatarUrl ?? '',
    rating: technician.rating,
    reviewCount: technician.reviewCount,
    distance: technician.distanceKm > 0
        ? '${technician.distanceKm.toStringAsFixed(1)} km'
        : '',
    startingPrice: technician.priceAmount ?? 0,
    isOnline: technician.isOnline,
    actionText: actionText,
    onBookTap: onBookTap,
    onCardTap: onCardTap,
    margin: margin,
  );

  factory AppSpecialistCard.fromBookingCandidate({
    Key? key,
    required BookingProviderCandidateEntity candidate,
    bool isSelected = false,
    VoidCallback? onSelect,
    VoidCallback? onCardTap,
    VoidCallback? onChat,
    void Function(DateTime slot)? onSelectSlot,
    EdgeInsetsGeometry? margin,
  }) {
    final distance =
        candidate.estimatedTravelDistanceKm ?? candidate.distanceKm;
    final disabledText = switch (candidate.reason) {
      'OUTSIDE_WORKING_HOURS' => 'Ngoài giờ làm',
      'PROVIDER_TIME_CONFLICT' => 'Trùng lịch',
      _ => 'Bận lịch',
    };

    return AppSpecialistCard(
      key: key,
      id: candidate.id,
      name: candidate.displayName,
      specialty: _specialty(
        candidate.badge,
        candidate.experienceYears,
        'năm KN',
      ),
      avatarUrl: candidate.avatarUrl ?? '',
      rating: candidate.rating,
      reviewCount: candidate.reviewCount,
      distance: '~${distance.toStringAsFixed(1)} km',
      startingPrice: candidate.priceAmount,
      priceSuffix: candidate.durationMinutes > 0
          ? '/ ${candidate.durationMinutes}p'
          : null,
      isOnline: candidate.available,
      isSelected: isSelected,
      actionText: isSelected ? 'Đã chọn' : 'Chọn thợ',
      isActionSelected: isSelected,
      isActionDisabled: !candidate.available,
      disabledActionText: disabledText,
      onBookTap: candidate.available ? onSelect : null,
      onCardTap: onCardTap ?? onSelect,
      onChatTap: onChat,
      bottomContent:
          !candidate.available &&
              candidate.suggestedSlots.isNotEmpty &&
              onSelectSlot != null
          ? _SuggestedSlots(
              slots: candidate.suggestedSlots,
              onSelect: onSelectSlot,
            )
          : null,
      margin: margin ?? EdgeInsets.zero,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: margin,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isSelected
              ? AppColors.primaryContainer
              : AppColors.surfaceContainer,
          width: isSelected ? 1.8 : 1,
        ),
      ),
      child: InkWell(
        onTap: isActionDisabled ? null : (onCardTap ?? onBookTap),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: _content(),
        ),
      ),
    );
  }

  Widget _content() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            _Avatar(name: name, url: avatarUrl, isOnline: isOnline),
            const SizedBox(width: 10),
            Expanded(
              child: _SpecialistInfo(
                name: name,
                specialty: specialty,
                rating: rating,
                reviewCount: reviewCount,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(child: _priceAndDistance()),
            _actionControl(),
          ],
        ),
        if (bottomContent != null) ...[
          const SizedBox(height: 6),
          bottomContent!,
        ],
      ],
    );
  }

  Widget _actionControl() {
    final action = isActionDisabled
        ? Chip(
            label: Text(disabledActionText ?? 'Bận lịch'),
            visualDensity: VisualDensity.compact,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          )
        : FilledButton.icon(
            onPressed: onBookTap ?? onCardTap,
            icon: isActionSelected
                ? const Icon(Icons.check_rounded, size: 14)
                : const SizedBox.shrink(),
            label: Text(
              actionText,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: isActionSelected
                  ? AppColors.primaryContainer
                  : AppColors.primary,
              foregroundColor: AppColors.onPrimary,
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.symmetric(horizontal: 10),
              minimumSize: const Size(0, 32),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(100),
              ),
            ),
          );
    final chat = IconButton.outlined(
      onPressed: onChatTap,
      constraints: const BoxConstraints.tightFor(width: 32, height: 32),
      padding: EdgeInsets.zero,
      visualDensity: VisualDensity.compact,
      icon: const Icon(Icons.chat_bubble_outline_rounded, size: 16),
    );
    if (onChatTap == null) return action;
    return Row(children: [chat, const SizedBox(width: 6), action]);
  }

  Widget _priceAndDistance() {
    final price = startingPrice > 0
        ? 'từ ${_currency.format(startingPrice)} đ'
        : '';
    return Wrap(
      spacing: 5,
      runSpacing: 2,
      children: [
        if (price.isNotEmpty)
          Text(
            price,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: AppColors.primary,
            ),
          ),
        if (priceSuffix != null)
          Text(priceSuffix!, style: const TextStyle(fontSize: 10)),
        if (distance.isNotEmpty) ...[
          const Text('•', style: TextStyle(fontSize: 10.5)),
          Text(distance, style: const TextStyle(fontSize: 10.5)),
        ],
      ],
    );
  }

  static String _specialty(String badge, int years, String yearLabel) {
    final parts = [
      if (badge.isNotEmpty) badge,
      if (years > 0) '$years $yearLabel',
    ];
    return parts.isEmpty ? 'Chuyên viên làm đẹp' : parts.join(' • ');
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final String url;
  final bool isOnline;

  const _Avatar({
    required this.name,
    required this.url,
    required this.isOnline,
  });

  @override
  Widget build(BuildContext context) {
    final fallback = Center(
      child: Text(
        name.isEmpty ? '?' : name[0].toUpperCase(),
        style: const TextStyle(
          fontWeight: FontWeight.bold,
          color: AppColors.primary,
        ),
      ),
    );
    return Stack(
      children: [
        CircleAvatar(
          radius: 22,
          backgroundColor: AppColors.surfaceContainerLow,
          child: ClipOval(
            child: url.isEmpty
                ? fallback
                : CachedNetworkImage(
                    imageUrl: url,
                    width: 44,
                    height: 44,
                    fit: BoxFit.cover,
                    errorWidget: (_, __, ___) => fallback,
                  ),
          ),
        ),
        Positioned(
          right: 0,
          bottom: 0,
          child: Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isOnline
                  ? AppColors.activeEmerald
                  : AppColors.outlineVariant,
              border: Border.all(
                color: AppColors.surfaceContainerLowest,
                width: 2,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SpecialistInfo extends StatelessWidget {
  final String name;
  final String specialty;
  final double? rating;
  final int reviewCount;

  const _SpecialistInfo({
    required this.name,
    required this.specialty,
    required this.rating,
    required this.reviewCount,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          name,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5),
        ),
        Text(
          specialty,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
        ),
        Row(
          children: [
            const Icon(Icons.star_rounded, size: 13, color: Color(0xFFEAB308)),
            const SizedBox(width: 2),
            Text(
              rating?.toStringAsFixed(1) ?? 'Chưa có đánh giá',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
            if (reviewCount > 0) ...[
              const SizedBox(width: 2),
              Text('($reviewCount)'),
            ],
          ],
        ),
      ],
    );
  }
}

class _SuggestedSlots extends StatelessWidget {
  final List<DateTime> slots;
  final ValueChanged<DateTime> onSelect;

  const _SuggestedSlots({required this.slots, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Giờ trống gợi ý (bấm để chọn lại):',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 5),
            Wrap(
              spacing: 6,
              children: slots
                  .take(3)
                  .map(
                    (slot) => ActionChip(
                      label: Text(DateFormat('HH:mm dd/MM').format(slot)),
                      onPressed: () => onSelect(slot),
                      visualDensity: VisualDensity.compact,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/widgets/app_specialist_card.dart';
import '../../../domain/entities/booking_provider_candidate_entity.dart';

export 'package:mobile/core/widgets/app_specialist_card.dart';

/// Thẻ chuyên viên phù hợp trong màn hình Chọn thợ khi đặt lịch
/// Kế thừa và sử dụng thống nhất từ AppSpecialistCard
class BookingProviderCard extends StatelessWidget {
  final BookingProviderCandidateEntity candidate;
  final bool isSelected;
  final VoidCallback? onSelect;
  final VoidCallback? onChat;
  final void Function(DateTime slot)? onSelectSlot;

  const BookingProviderCard({
    super.key,
    required this.candidate,
    this.isSelected = false,
    this.onSelect,
    this.onChat,
    this.onSelectSlot,
  });

  @override
  Widget build(BuildContext context) {
    return AppSpecialistCard.fromBookingCandidate(
      candidate: candidate,
      isSelected: isSelected,
      onSelect: onSelect,
      onCardTap: () => context.push('/providers/${candidate.id}/public'),
      onChat: onChat,
      onSelectSlot: onSelectSlot,
      margin: const EdgeInsets.only(bottom: 10),
    );
  }
}

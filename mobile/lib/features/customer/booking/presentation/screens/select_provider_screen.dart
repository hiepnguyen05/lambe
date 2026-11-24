import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

import '../../domain/entities/booking_draft_entity.dart';
import '../../domain/entities/booking_provider_candidate_entity.dart';
import '../providers/booking_candidates_provider.dart';
import '../providers/booking_draft_provider.dart';
import '../widgets/booking_step_progress_bar.dart';
import '../widgets/provider/booking_provider_card.dart';
import '../widgets/provider/provider_pre_chat_sheet.dart';
import '../widgets/provider/select_provider_bottom_bar.dart';
import '../widgets/provider/select_provider_filter_bar.dart';

class SelectProviderScreen extends ConsumerStatefulWidget {
  const SelectProviderScreen({super.key});

  @override
  ConsumerState<SelectProviderScreen> createState() =>
      _SelectProviderScreenState();
}

class _SelectProviderScreenState extends ConsumerState<SelectProviderScreen> {
  BookingProviderCandidateEntity? _selectedCandidate;

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(bookingDraftProvider);

    if (draft == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Chọn chuyên viên')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Chưa có thông tin dịch vụ đặt lịch.'),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => context.pop(),
                child: const Text('Quay lại'),
              ),
            ],
          ),
        ),
      );
    }

    final candidatesAsync = ref.watch(filteredBookingCandidatesProvider);
    final filterState = ref.watch(candidateFilterProvider);

    final allCandidates = candidatesAsync.valueOrNull ?? [];
    final activeCandidate =
        _selectedCandidate != null &&
            allCandidates.any((c) => c.id == _selectedCandidate?.id)
        ? _selectedCandidate
        : allCandidates.where((c) => c.available).firstOrNull;
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        title: const Text(
          'Chọn chuyên viên',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0B1C30),
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 20,
            color: Color(0xFF0B1C30),
          ),
          onPressed: () => context.pop(),
        ),
        bottom: const BookingStepProgressBar(currentStep: 2),
      ),
      body: Column(
        children: [
          // Tóm tắt dịch vụ & địa chỉ đang chọn
          _buildServiceSummaryCard(context, draft),

          // Thanh bộ lọc chuyên viên (Sẵn sàng ngay, Gần nhất, 4.8+ sao, Giá)
          const SelectProviderFilterBar(),

          // Danh sách chuyên viên
          Expanded(
            child: candidatesAsync.when(
              loading: () => const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    CircularProgressIndicator(color: Color(0xFF0F766E)),
                    SizedBox(height: 16),
                    Text(
                      'Đang tìm chuyên viên phù hợp quanh bạn...',
                      style: TextStyle(
                        fontSize: 13.5,
                        color: Color(0xFF64748B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              error: (err, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.wifi_off_rounded,
                        size: 48,
                        color: Color(0xFF94A3B8),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        'Không thể tải danh sách chuyên viên',
                        style: TextStyle(
                          fontSize: 15.5,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0B1C30),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '$err',
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: () =>
                            ref.invalidate(bookingCandidatesProvider),
                        icon: const Icon(Icons.refresh_rounded, size: 18),
                        label: const Text('Thử lại'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0F766E),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(100),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              data: (candidates) {
                if (candidates.isEmpty) {
                  return _buildEmptyState(
                    context,
                    filterState.hasActiveFilters,
                    draft.rematchSourceOrderId != null,
                  );
                }

                return RefreshIndicator(
                  color: const Color(0xFF0F766E),
                  onRefresh: () async {
                    ref.invalidate(bookingCandidatesProvider);
                  },
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
                    children: [
                      // Số lượng chuyên viên phù hợp
                      Row(
                        children: [
                          Text(
                            '${candidates.length} chuyên viên phù hợp',
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1E293B),
                            ),
                          ),
                          const Spacer(),
                          if (filterState.hasActiveFilters)
                            TextButton.icon(
                              onPressed: () => ref
                                  .read(candidateFilterProvider.notifier)
                                  .reset(),
                              icon: const Icon(
                                Icons.refresh_rounded,
                                size: 14,
                                color: Color(0xFF0F766E),
                              ),
                              label: const Text(
                                'Xem tất cả',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF0F766E),
                                ),
                              ),
                              style: TextButton.styleFrom(
                                padding: EdgeInsets.zero,
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                            ),
                        ],
                      ),
                      // Hướng dẫn thân thiện
                      Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEFF6F5),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: const Color(0xFF0F766E)
                                .withValues(alpha: 0.15),
                          ),
                        ),
                        child: const Row(
                          children: [
                            Icon(
                              Icons.chat_bubble_outline_rounded,
                              size: 15,
                              color: Color(0xFF0F766E),
                            ),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Bấm vào biểu tượng tin nhắn trên thẻ chuyên viên để hỏi trước về lịch hẹn và dịch vụ.',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF0F766E),
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Danh sách thẻ chuyên viên kèm giá chi tiết
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: candidates.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final candidate = candidates[index];
                          final isSelected =
                              activeCandidate?.id == candidate.id;

                          return BookingProviderCard(
                            candidate: candidate,
                            isSelected: isSelected,
                            onSelect: candidate.available
                                ? () {
                                    setState(() {
                                      _selectedCandidate = candidate;
                                    });
                                  }
                                : null,
                            onChat: () =>
                                ProviderPreChatSheet.show(context, candidate),
                            onSelectSlot: draft.rematchSourceOrderId != null
                                ? null
                                : (slot) {
                                    ref
                                        .read(bookingDraftProvider.notifier)
                                        .setScheduledAt(slot);
                                    ref.invalidate(bookingCandidatesProvider);
                                    AppDialog.info(
                                      context,
                                      title: 'Đã đổi khung giờ',
                                      message:
                                          'Đã chọn giờ gợi ý: ${DateFormat('HH:mm - dd/MM/yyyy').format(slot)}',
                                    );
                                  },
                          );
                        },
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
      bottomNavigationBar: SelectProviderBottomBar(
        selectedCandidate: activeCandidate,
        onContinue: () {
          if (activeCandidate != null) {
            _handleProceedToConfirmation(draft, activeCandidate);
          }
        },
      ),
    );
  }

  Widget _buildEmptyState(
    BuildContext context,
    bool hasActiveFilters,
    bool isRematch,
  ) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6F5),
                shape: BoxShape.circle,
                border: Border.all(
                  color: const Color(0xFF0F766E).withValues(alpha: 0.15),
                ),
              ),
              child: const Icon(
                Icons.person_search_rounded,
                size: 38,
                color: Color(0xFF0F766E),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              hasActiveFilters
                  ? 'Không có chuyên viên khớp bộ lọc'
                  : 'Chưa có chuyên viên khả dụng',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0B1C30),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              hasActiveFilters
                  ? 'Hãy thử nới lỏng hoặc bỏ bớt các tiêu chí lọc để xem thêm nhiều chuyên viên khác.'
                  : isRematch
                  ? 'Chưa có chuyên viên khác phù hợp với địa chỉ và thời gian của đơn này.'
                  : 'Hiện chưa có chuyên viên nào nhận dịch vụ trong bán kính này hoặc các chuyên viên đang bận lịch. Bạn có thể thử thay đổi thời gian hoặc địa chỉ khác.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                height: 1.45,
              ),
            ),
            const SizedBox(height: 20),
            if (hasActiveFilters)
              ElevatedButton.icon(
                onPressed: () =>
                    ref.read(candidateFilterProvider.notifier).reset(),
                icon: const Icon(Icons.refresh_rounded, size: 18),
                label: const Text('Bỏ lọc & Xem tất cả'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                ),
              )
            else if (!isRematch)
              ElevatedButton.icon(
                onPressed: () => context.pop(),
                icon: const Icon(Icons.tune_rounded, size: 18),
                label: const Text('Thay đổi cấu hình lịch'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _handleProceedToConfirmation(
    BookingDraftEntity draft,
    BookingProviderCandidateEntity candidate,
  ) {
    // Lưu chuyên viên đã chọn vào draft provider
    ref
        .read(bookingDraftProvider.notifier)
        .selectProvider(
          providerId: candidate.id,
          providerServiceId: candidate.providerServiceId,
          providerDisplayName: candidate.displayName,
          providerAvatarUrl: candidate.avatarUrl,
          providerPriceAmount: candidate.priceAmount,
          providerDistanceKm: candidate.distanceKm,
        );

    // Chuyển sang Màn hình Step 3: Báo giá & Xác nhận đơn
    context.push('/booking/confirm');
  }

  Widget _buildServiceSummaryCard(
    BuildContext context,
    BookingDraftEntity draft,
  ) {
    final address =
        draft.selectedAddress?.addressLine ??
        draft.inlineAddress?.addressLine ??
        'Tại địa chỉ của bạn';

    final isAsap = draft.bookingType == BookingType.asap;
    final timeText = isAsap
        ? '⚡ Phục vụ làm ngay'
        : '📅 ${draft.scheduledAt != null ? DateFormat('HH:mm - dd/MM/yyyy').format(draft.scheduledAt!) : 'Hẹn trước'}';

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 6, 16, 4),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.02),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6F5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.content_cut_rounded,
              color: Color(0xFF0F766E),
              size: 18,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  draft.service.name,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF0F172A),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        timeText,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: isAsap
                              ? const Color(0xFFD97706)
                              : const Color(0xFF0F766E),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const Text(
                      ' • ',
                      style: TextStyle(color: Color(0xFFCBD5E1)),
                    ),
                    Flexible(
                      child: Text(
                        address,
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF64748B),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          if (draft.rematchSourceOrderId == null)
            InkWell(
              onTap: () => context.pop(),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'Đổi',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF475569),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

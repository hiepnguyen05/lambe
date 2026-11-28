import 'package:flutter/material.dart';
import 'package:mobile/features/shared/guidance/presentation/guidance_trigger.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/features/shared/address/di/address_providers.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';

import '../providers/booking_draft_provider.dart';
import '../../domain/entities/provider_booking_entry.dart';
import '../widgets/booking_step_progress_bar.dart';
import '../widgets/config/booking_config_address_section.dart';
import '../widgets/config/booking_config_bottom_bar.dart';
import '../widgets/config/booking_config_contact_section.dart';
import '../widgets/config/booking_config_note_section.dart';
import '../widgets/config/booking_config_service_card.dart';
import '../widgets/config/booking_config_time_section.dart';
import '../widgets/config/booking_specialist_picker.dart';

class BookingConfigScreen extends ConsumerStatefulWidget {
  final ServiceItemEntity service;
  final ProviderBookingEntry? initialProvider;

  const BookingConfigScreen({
    super.key,
    required this.service,
    this.initialProvider,
  });

  @override
  ConsumerState<BookingConfigScreen> createState() =>
      _BookingConfigScreenState();
}

class _BookingConfigScreenState extends ConsumerState<BookingConfigScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initDraftIfNeeded();
    });
  }

  void _initDraftIfNeeded() {
    final addressesAsync = ref.read(addressNotifierProvider);
    final user = ref.read(authNotifierProvider).valueOrNull;

    final addresses = addressesAsync.valueOrNull ?? [];
    final defaultAddr = addresses.isNotEmpty
        ? addresses.firstWhere(
            (a) => a.isDefault,
            orElse: () => addresses.first,
          )
        : null;

    ref
        .read(bookingDraftProvider.notifier)
        .initialize(
          service: widget.service,
          defaultAddress: defaultAddr,
          defaultContactName: user?.fullName,
          defaultContactPhone: user?.phone,
        );
    final provider = widget.initialProvider;
    if (provider != null) {
      ref
          .read(bookingDraftProvider.notifier)
          .selectProvider(
            providerId: provider.providerId,
            providerServiceId: provider.providerServiceId,
            providerDisplayName: provider.providerDisplayName,
            providerAvatarUrl: provider.providerAvatarUrl,
            providerPriceAmount: provider.priceAmount,
            assignedMemberId: provider.assignedMemberId,
            assignedMemberName: provider.assignedMemberName,
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Lắng nghe cập nhật danh sách địa chỉ để tự điền nếu vừa tải xong
    ref.listen(addressNotifierProvider, (_, next) {
      final addresses = next.valueOrNull ?? [];
      final currentDraft = ref.read(bookingDraftProvider);
      if (currentDraft != null &&
          currentDraft.customerAddressId == null &&
          addresses.isNotEmpty) {
        final defaultAddr = addresses.firstWhere(
          (a) => a.isDefault,
          orElse: () => addresses.first,
        );
        ref.read(bookingDraftProvider.notifier).selectSavedAddress(defaultAddr);
      }
    });

    final draft = ref.watch(bookingDraftProvider);

    if (draft == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF0F766E)),
        ),
      );
    }

    return GuidanceTrigger(
      tourId: 'customer_booking',
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          title: const Text(
            'Cấu hình đặt lịch',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0B1C30),
            ),
          ),
          centerTitle: true,
          backgroundColor: Colors.white,
          elevation: 0,
          surfaceTintColor: Colors.transparent,
          leading: IconButton(
            icon: const Icon(
              Icons.arrow_back_ios_new_rounded,
              size: 19,
              color: Color(0xFF0B1C30),
            ),
            onPressed: () => context.pop(),
          ),
          bottom: const BookingStepProgressBar(currentStep: 1),
        ),
        body: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Card tóm tắt dịch vụ đã chọn
              BookingConfigServiceCard(service: widget.service),
              const SizedBox(height: 12),

              // Khối thông tin người nhận (Họ tên & Số điện thoại)
              BookingConfigContactSection(draft: draft),
              const SizedBox(height: 12),

              // Khối địa chỉ đón chuyên viên
              GuidanceAnchor(
                id: 'booking_address',
                child: BookingConfigAddressSection(draft: draft),
              ),
              const SizedBox(height: 12),

              // Khối chọn chuyên gia phục vụ (Đối tác tổ chức)
              BookingSpecialistPicker(draft: draft),
              if (draft.providerId != null && draft.providerId!.isNotEmpty)
                const SizedBox(height: 12),

              // Khối thời gian (Đặt ngay ASAP hoặc Đặt lịch hẹn SCHEDULED)
              GuidanceAnchor(
                id: 'booking_time',
                child: BookingConfigTimeSection(draft: draft),
              ),
              const SizedBox(height: 12),

              // Khối ghi chú cho chuyên viên
              BookingConfigNoteSection(draft: draft),
              const SizedBox(height: 20),
            ],
          ),
        ),
        bottomNavigationBar: BookingConfigBottomBar(
          draft: draft,
          continueToQuote: widget.initialProvider != null,
          onContinue: () {
            context.push(
              widget.initialProvider != null
                  ? '/booking/confirm'
                  : '/booking/providers',
            );
          },
        ),
      ),
    );
  }
}

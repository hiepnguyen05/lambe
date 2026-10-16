import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../address/di/address_providers.dart';
import '../../../auth/di/auth_providers.dart';
import '../../../catalog/domain/entities/service_item_entity.dart';
import '../providers/booking_draft_provider.dart';
import '../widgets/booking_step_progress_bar.dart';
import '../widgets/config/booking_config_address_section.dart';
import '../widgets/config/booking_config_bottom_bar.dart';
import '../widgets/config/booking_config_note_section.dart';
import '../widgets/config/booking_config_service_card.dart';
import '../widgets/config/booking_config_time_section.dart';

class BookingConfigScreen extends ConsumerStatefulWidget {
  final ServiceItemEntity service;

  const BookingConfigScreen({
    super.key,
    required this.service,
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
    final user = ref.read(authNotifierProvider).value;

    final addresses = addressesAsync.value ?? [];
    final defaultAddr = addresses.isNotEmpty
        ? addresses.firstWhere(
            (a) => a.isDefault,
            orElse: () => addresses.first,
          )
        : null;

    ref.read(bookingDraftProvider.notifier).initialize(
          service: widget.service,
          defaultAddress: defaultAddr,
          defaultContactName: user?.fullName,
          defaultContactPhone: user?.phone,
        );
  }

  @override
  Widget build(BuildContext context) {
    // Lắng nghe cập nhật danh sách địa chỉ để tự điền nếu vừa tải xong
    ref.listen(addressNotifierProvider, (_, next) {
      final addresses = next.value ?? [];
      final currentDraft = ref.read(bookingDraftProvider);
      if (currentDraft != null &&
          currentDraft.customerAddressId == null &&
          addresses.isNotEmpty) {
        final defaultAddr = addresses.firstWhere(
          (a) => a.isDefault,
          orElse: () => addresses.first,
        );
        ref
            .read(bookingDraftProvider.notifier)
            .selectSavedAddress(defaultAddr);
      }
    });

    final draft = ref.watch(bookingDraftProvider);

    if (draft == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8F9FF),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF0F766E)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        title: const Text(
          'Cấu hình đặt lịch',
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
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              size: 20, color: Color(0xFF0B1C30)),
          onPressed: () => context.pop(),
        ),
        bottom: const BookingStepProgressBar(currentStep: 1),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Card tóm tắt dịch vụ đã chọn
            BookingConfigServiceCard(service: widget.service),
            const SizedBox(height: 16),

            // Khối địa chỉ phục vụ & người nhận
            BookingConfigAddressSection(draft: draft),
            const SizedBox(height: 16),

            // Khối thời gian (Đặt ngay ASAP hoặc Đặt lịch hẹn SCHEDULED)
            BookingConfigTimeSection(draft: draft),
            const SizedBox(height: 16),

            // Khối ghi chú cho chuyên viên
            BookingConfigNoteSection(draft: draft),
            const SizedBox(height: 24),
          ],
        ),
      ),
      bottomNavigationBar: BookingConfigBottomBar(
        draft: draft,
        onContinue: () {
          _handleProceedToSelectProvider(draft);
        },
      ),
    );
  }

  void _handleProceedToSelectProvider(dynamic draft) {
    // Điều hướng sang màn hình chọn chuyên viên
    context.push('/booking/providers');
  }
}

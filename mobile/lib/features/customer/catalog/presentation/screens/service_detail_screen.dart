import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../domain/entities/service_item_entity.dart';
import '../providers/selected_services_provider.dart';
import '../providers/service_detail_provider.dart';
import '../widgets/detail/service_detail_app_bar.dart';
import '../widgets/detail/service_detail_bottom_bar.dart';
import '../widgets/detail/service_detail_hero.dart';
import '../widgets/detail/service_detail_overview_card.dart';
import '../widgets/detail/service_detail_process_steps.dart';

class ServiceDetailScreen extends ConsumerStatefulWidget {
  final ServiceItemEntity? initialService;
  final String serviceSlug;

  const ServiceDetailScreen({
    super.key,
    this.initialService,
    required this.serviceSlug,
  });

  @override
  ConsumerState<ServiceDetailScreen> createState() =>
      _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends ConsumerState<ServiceDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final slug = widget.serviceSlug.isNotEmpty
        ? widget.serviceSlug
        : (widget.initialService?.slug ?? '');

    // Nếu có initialService thì dùng ngay để hiển thị tức thì, song song gọi API lấy dữ liệu mới nhất
    final serviceAsync = slug.isNotEmpty
        ? ref.watch(serviceDetailBySlugProvider(slug))
        : null;

    final service = serviceAsync?.valueOrNull ?? widget.initialService;

    if (service == null) {
      if (serviceAsync?.isLoading ?? true) {
        return const Scaffold(
          backgroundColor: AppColors.surface,
          appBar: ServiceDetailAppBar(),
          body: Center(
            child: CircularProgressIndicator(color: AppColors.primaryContainer),
          ),
        );
      }

      return Scaffold(
        backgroundColor: AppColors.surface,
        appBar: const ServiceDetailAppBar(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.info_outline,
                  size: 48,
                  color: AppColors.outline,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Dịch vụ hiện không khả dụng hoặc đã bị gỡ',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => context.pop(),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primaryContainer,
                    foregroundColor: AppColors.onPrimary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
                  ),
                  child: const Text('Quay lại'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: const ServiceDetailAppBar(),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. Banner Hero ảnh dịch vụ, badge "Phổ biến nhất" & thời lượng
            ServiceDetailHero(
              imageUrl: service.coverImageUrl,
              durationMinutes: service.defaultDurationMinutes,
            ),
            const SizedBox(height: 12),

            // 2. Thẻ Thông tin Dịch Vụ Chính (Giá, Tiệt trùng Y tế, Đánh giá) & Thẻ Mô Tả
            ServiceDetailOverviewCard(
              title: service.name,
              description: service.description,
              minPriceAmount: service.minPriceAmount,
            ),
            const SizedBox(height: 16),

            // 3. Quy trình thực hiện chuẩn 4 bước an tâm tại nhà
            const ServiceDetailProcessSteps(),
            const SizedBox(height: 16),

            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Chọn địa chỉ và thời gian ở bước đặt lịch để tìm chuyên viên phù hợp.',
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: ServiceDetailBottomBar(
        onSelectService: () => _handleSelectService(service),
        buttonText: 'Đặt lịch ngay',
      ),
    );
  }

  void _handleSelectService(ServiceItemEntity service) {
    ref.read(selectedServicesProvider.notifier).select(service);
    context.push('/booking/config', extra: service);
  }
}

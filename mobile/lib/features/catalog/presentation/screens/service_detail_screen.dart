import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../domain/entities/nearby_technician_entity.dart';
import '../../domain/entities/service_item_entity.dart';
import '../providers/selected_services_provider.dart';
import '../providers/service_detail_provider.dart';
import '../widgets/detail/service_detail_app_bar.dart';
import '../widgets/detail/service_detail_bottom_bar.dart';
import '../widgets/detail/service_detail_hero.dart';
import '../widgets/detail/service_detail_overview_card.dart';
import '../widgets/detail/service_detail_process_steps.dart';
import '../widgets/detail/service_detail_reviews_section.dart';
import '../widgets/detail/service_detail_technicians_rail.dart';
import '../widgets/detail/service_detail_trust_metrics.dart';

class ServiceDetailScreen extends ConsumerStatefulWidget {
  final ServiceItemEntity? initialService;
  final String serviceSlug;

  const ServiceDetailScreen({
    super.key,
    this.initialService,
    required this.serviceSlug,
  });

  @override
  ConsumerState<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
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

    final service = serviceAsync?.value ?? widget.initialService;

    if (service == null) {
      if (serviceAsync?.isLoading ?? true) {
        return Scaffold(
          backgroundColor: const Color(0xFFF8F9FF),
          appBar: const ServiceDetailAppBar(title: 'Chi tiết dịch vụ'),
          body: const Center(
            child: CircularProgressIndicator(
              color: Color(0xFF0F766E),
            ),
          ),
        );
      }

      return Scaffold(
        backgroundColor: const Color(0xFFF8F9FF),
        appBar: const ServiceDetailAppBar(title: 'Không tìm thấy dịch vụ'),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.info_outline, size: 48, color: Color(0xFF94A3B8)),
              const SizedBox(height: 12),
              const Text(
                'Dịch vụ hiện không khả dụng hoặc đã bị gỡ',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF475569),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                ),
                child: const Text('Quay lại'),
              ),
            ],
          ),
        ),
      );
    }

    // Lấy danh sách chuyên viên gần đây từ discovery API
    final nearbyAsync = ref.watch(nearbyTechniciansProvider(service.id));
    final technicians = nearbyAsync.value ?? const <NearbyTechnicianEntity>[];

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: ServiceDetailAppBar(
        title: service.name,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Banner Hero ảnh dịch vụ & thời lượng
            ServiceDetailHero(
              imageUrl: service.coverImageUrl,
              durationMinutes: service.defaultDurationMinutes,
            ),
            const SizedBox(height: 14),

            // 3 Chỉ số uy tín (Đánh giá, Lượt đặt là 0 khi chưa có, 100% Hài lòng cho mọi dịch vụ)
            const ServiceDetailTrustMetrics(
              rating: 0.0,
              reviewCountText: '0 đánh giá',
              bookingCountText: '0 lượt đặt',
              guaranteeBadgeText: '100%',
              guaranteeSubText: 'Hài lòng dịch vụ',
            ),
            const SizedBox(height: 16),

            // Thẻ thông tin dịch vụ, giá & tags
            ServiceDetailOverviewCard(
              title: service.name,
              description: service.description,
              minPriceAmount: service.minPriceAmount,
              tags: [
                'Phục vụ tận nơi',
                'Chuyên viên xác minh tay nghề',
                'An toàn & Chu đáo',
                if (service.requiresCertificate) 'Chứng chỉ chuyên môn',
              ],
            ),
            const SizedBox(height: 20),

            // Quy chuẩn 3 bước an tâm tại nhà
            const ServiceDetailProcessSteps(),
            const SizedBox(height: 20),

            // Danh sách chuyên viên gần bạn (Dữ liệu thật từ discovery API)
            ServiceDetailTechniciansRail(
              technicians: technicians,
              onSelectTechnician: (tech) {
                _handleSelectTechnician(service, tech);
              },
            ),
            const SizedBox(height: 20),

            // Nhận xét khách hàng thực tế (Hiện hiển thị chưa có đánh giá)
            const ServiceDetailReviewsSection(),
            const SizedBox(height: 24),
          ],
        ),
      ),
      bottomNavigationBar: ServiceDetailBottomBar(
        onSelectService: () => _handleSelectService(service),
        buttonText: 'Chọn dịch vụ này',
      ),
    );
  }

  void _handleSelectService(ServiceItemEntity service) {
    ref.read(selectedServicesProvider.notifier).select(service);
    context.push('/booking/config', extra: service);
  }

  void _handleSelectTechnician(
      ServiceItemEntity service, NearbyTechnicianEntity tech) {
    ref.read(selectedServicesProvider.notifier).select(service);
    context.push('/booking/config', extra: service);
  }
}

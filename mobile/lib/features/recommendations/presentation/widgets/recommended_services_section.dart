import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../di/recommendations_providers.dart';
import '../../domain/entities/service_recommendations_entity.dart';

class RecommendedServicesSection extends ConsumerWidget {
  const RecommendedServicesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(serviceRecommendationsProvider);

    return state.when(
      loading: () => const SizedBox(
        height: 220,
        child: Center(
          child: CircularProgressIndicator(color: Color(0xFF0F766E)),
        ),
      ),
      error: (_, __) => _LoadError(
        onRetry: ref.read(serviceRecommendationsProvider.notifier).load,
      ),
      data: (recommendations) {
        if (recommendations.services.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              recommendations.personalized
                  ? 'Dành cho bạn'
                  : 'Khám phá dịch vụ',
              style: Theme.of(context).textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 238,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: recommendations.services.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, index) =>
                    _ServiceCard(service: recommendations.services[index]),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ServiceCard extends StatelessWidget {
  final RecommendedServiceEntity service;

  const _ServiceCard({required this.service});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 208,
      child: Material(
        color: Colors.white,
        clipBehavior: Clip.antiAlias,
        borderRadius: BorderRadius.circular(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: double.infinity,
              height: 112,
              child: _ServiceImage(url: service.coverImageUrl),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      service.categoryName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFFB45309),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      service.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF0B1C30),
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _priceLabel(service),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Color(0xFF0F766E),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (service.defaultDurationMinutes != null) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.schedule,
                            size: 14,
                            color: Color(0xFF6E7977),
                          ),
                          const SizedBox(width: 3),
                          Text(
                            '${service.defaultDurationMinutes}p',
                            style: const TextStyle(
                              color: Color(0xFF6E7977),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _priceLabel(RecommendedServiceEntity service) {
    final price = service.minPriceAmount;
    if (price == null) return 'Liên hệ';
    final formatted = NumberFormat.decimalPattern('vi_VN').format(price);
    return 'Từ $formatted đ';
  }
}

class _ServiceImage extends StatelessWidget {
  final String? url;

  const _ServiceImage({required this.url});

  @override
  Widget build(BuildContext context) {
    final uri = Uri.tryParse(url ?? '');
    if (uri != null && (uri.scheme == 'http' || uri.scheme == 'https')) {
      return Image.network(
        uri.toString(),
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const _ImageFallback(),
      );
    }
    return const _ImageFallback();
  }
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFFE7F6F3),
      child: Center(
        child: Icon(Icons.spa_outlined, size: 38, color: Color(0xFF0F766E)),
      ),
    );
  }
}

class _LoadError extends StatelessWidget {
  final VoidCallback onRetry;

  const _LoadError({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          const Expanded(
            child: Text(
              'Chưa thể tải dịch vụ gợi ý.',
              style: TextStyle(color: Color(0xFF6E7977)),
            ),
          ),
          IconButton(
            tooltip: 'Tải lại',
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
    );
  }
}

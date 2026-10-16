import 'dart:ui';
import 'package:flutter/material.dart';

class ServiceDetailHero extends StatelessWidget {
  final String? imageUrl;
  final int durationMinutes;

  const ServiceDetailHero({
    super.key,
    this.imageUrl,
    required this.durationMinutes,
  });

  @override
  Widget build(BuildContext context) {
    const defaultImage =
        'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=1000&q=80';
    final effectiveImage = (imageUrl != null && imageUrl!.startsWith('http'))
        ? imageUrl!
        : defaultImage;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Container(
          height: 270,
          width: double.infinity,
          decoration: BoxDecoration(
            color: const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.08),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Ảnh nền Banner
              Image.network(
                effectiveImage,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => Container(
                  color: const Color(0xFFE6F4F1),
                  child: const Center(
                    child: Icon(
                      Icons.spa_rounded,
                      size: 64,
                      color: Color(0xFF0F766E),
                    ),
                  ),
                ),
                loadingBuilder: (context, child, loadingProgress) {
                  if (loadingProgress == null) return child;
                  return Container(
                    color: const Color(0xFFF1F5F9),
                    child: const Center(
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  );
                },
              ),

              // Lớp Gradient phủ tạo tương phản nghệ thuật
              Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.15),
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.55),
                    ],
                    stops: const [0.0, 0.45, 1.0],
                  ),
                ),
              ),

              // Chip hiển thị thời lượng dịch vụ ở góc dưới bên trái
              Positioned(
                left: 16,
                bottom: 16,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(100),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      color: Colors.white.withValues(alpha: 0.88),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.schedule_rounded,
                            size: 15,
                            color: Color(0xFF0F766E),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            '$durationMinutes phút',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A),
                              letterSpacing: 0.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

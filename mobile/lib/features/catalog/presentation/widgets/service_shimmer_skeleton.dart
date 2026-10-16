import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class ServiceShimmerSkeleton extends StatefulWidget {
  const ServiceShimmerSkeleton({super.key});

  @override
  State<ServiceShimmerSkeleton> createState() => _ServiceShimmerSkeletonState();
}

class _ServiceShimmerSkeletonState extends State<ServiceShimmerSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacityAnim;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    _opacityAnim = Tween<double>(begin: 0.35, end: 0.85).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacityAnim,
      builder: (context, _) {
        return ListView.builder(
          physics: const NeverScrollableScrollPhysics(),
          shrinkWrap: true,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          itemCount: 4,
          itemBuilder: (context, index) {
            return Container(
              margin: const EdgeInsets.only(bottom: 14),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.surfaceContainerHigh.withValues(alpha: 0.5),
                ),
              ),
              child: Row(
                children: [
                  // Box icon thumbnail
                  Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceContainer
                          .withValues(alpha: _opacityAnim.value),
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  const SizedBox(width: 14),
                  // Box text lines
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 80,
                          height: 14,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceContainer
                                .withValues(alpha: _opacityAnim.value),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          height: 18,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceContainer
                                .withValues(alpha: _opacityAnim.value),
                            borderRadius: BorderRadius.circular(6),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          width: 140,
                          height: 12,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceContainer
                                .withValues(alpha: _opacityAnim.value),
                            borderRadius: BorderRadius.circular(4),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              width: 90,
                              height: 16,
                              decoration: BoxDecoration(
                                color: AppColors.surfaceContainer
                                    .withValues(alpha: _opacityAnim.value),
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            Container(
                              width: 60,
                              height: 24,
                              decoration: BoxDecoration(
                                color: AppColors.surfaceContainer
                                    .withValues(alpha: _opacityAnim.value),
                                borderRadius: BorderRadius.circular(100),
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
          },
        );
      },
    );
  }
}

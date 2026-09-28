import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/app_logo.dart';

class SplashScreen extends StatefulWidget {
  final VoidCallback? onInitializationComplete;

  const SplashScreen({
    super.key,
    this.onInitializationComplete,
  });

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeIn),
    );

    _scaleAnimation = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutBack),
    );

    _animationController.forward().then((_) {
      if (widget.onInitializationComplete != null) {
        Future.delayed(const Duration(milliseconds: 800), () {
          widget.onInitializationComplete?.call();
        });
      }
    });
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Center(
          child: AnimatedBuilder(
            animation: _animationController,
            builder: (context, child) {
              return FadeTransition(
                opacity: _fadeAnimation,
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Spacer(),
                      // Brand Logo
                      const AppLogo(width: 140, height: 140),
                      const SizedBox(height: 28),
                      // Brand Name
                      Text(
                        'LAMBE',
                        style: AppTypography.headlineXl.copyWith(
                          color: AppColors.primaryContainer,
                          letterSpacing: 2.0,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      // Tagline
                      Text(
                        'NỀN TẢNG ĐẶT LỊCH LÀM ĐẸP TẬN NHÀ',
                        style: AppTypography.labelMd.copyWith(
                          color: AppColors.secondary,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const Spacer(),
                      // Subtle Loading Indicator
                      const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                        ),
                      ),
                      const SizedBox(height: 48),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

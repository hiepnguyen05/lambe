import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/mascot/lambe_mascot.dart';

/// Floating Action Button linh vật Chatbot AI 3D trên màn hình trang chủ khách hàng.
class HomeChatbotMascotFab extends StatefulWidget {
  final VoidCallback? onChatTap;

  const HomeChatbotMascotFab({
    super.key,
    this.onChatTap,
  });

  @override
  State<HomeChatbotMascotFab> createState() => _HomeChatbotMascotFabState();
}

class _HomeChatbotMascotFabState extends State<HomeChatbotMascotFab>
    with WidgetsBindingObserver {
  bool _showBubble = true;
  bool _foreground = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _foreground = WidgetsBinding.instance.lifecycleState == null ||
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed;
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (_foreground != foreground) {
      setState(() => _foreground = foreground);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isRouteActive = ModalRoute.of(context)?.isCurrent ?? true;
    final isPlaying = _foreground && isRouteActive;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // 1. Bong bóng chào hỏi
        if (_showBubble)
          AnimatedOpacity(
            duration: const Duration(milliseconds: 300),
            opacity: _showBubble ? 1.0 : 0.0,
            child: Container(
              margin: const EdgeInsets.only(bottom: 8, right: 4),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              constraints: const BoxConstraints(maxWidth: 230),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLowest.withValues(alpha: 0.96),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.2),
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: () => _handleTap(context),
                      child: const Text(
                        '✨ Em ở đây, cần tư vấn sắc đẹp không ạ?',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.onSurface,
                          height: 1.3,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  GestureDetector(
                    onTap: () => setState(() => _showBubble = false),
                    child: const Padding(
                      padding: EdgeInsets.all(2.0),
                      child: Icon(
                        Icons.close_rounded,
                        size: 13,
                        color: AppColors.outline,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

        // 2. Nút tròn chứa linh vật 3D với màu nền #EBF5F4, đèn xanh online
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => _handleTap(context),
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              // Vòng tròn chứa linh vật 3D với màu nền #EBF5F4
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFEBF5F4),
                  border: Border.all(
                    color: const Color(0xFF005C55).withValues(alpha: 0.20),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF005C55).withValues(alpha: 0.15),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 6,
                    ),
                  ],
                ),
                child: ClipOval(
                  child: Center(
                    child: LambeMascot(
                      size: 64,
                      showShadow: false,
                      showSparkles: false,
                      enableInteraction: false,
                      onTap: () => _handleTap(context),
                      isPlaying: isPlaying,
                    ),
                  ),
                ),
              ),

              // Đèn xanh online ở góc dưới phải
              Positioned(
                bottom: 2,
                right: 2,
                child: Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white,
                      width: 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.15),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _handleTap(BuildContext context) {
    if (widget.onChatTap != null) {
      widget.onChatTap!();
    } else {
      context.push('/ai-consultation');
    }
  }
}

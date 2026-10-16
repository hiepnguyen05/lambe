import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../lambe_mascot.dart';

/// Widget nút tròn trợ lý AI nổi với linh vật Lambe 3D
class MascotBubbleButton extends StatefulWidget {
  final VoidCallback? onTap;
  final String? tooltipMessage;

  const MascotBubbleButton({
    super.key,
    this.onTap,
    this.tooltipMessage = 'Hỏi trợ lý sắc đẹp AI',
  });

  @override
  State<MascotBubbleButton> createState() => _MascotBubbleButtonState();
}

class _MascotBubbleButtonState extends State<MascotBubbleButton> {
  bool _showBubble = true;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // Bong bóng hội thoại gợi ý nhỏ xinh phía trên
        if (_showBubble && widget.tooltipMessage != null) ...[
          Container(
            margin: const EdgeInsets.only(bottom: 6, right: 4),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.15),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.auto_awesome,
                  size: 13,
                  color: AppColors.primary,
                ),
                const SizedBox(width: 5),
                Text(
                  widget.tooltipMessage!,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(width: 4),
                GestureDetector(
                  onTap: () => setState(() => _showBubble = false),
                  child: const Icon(
                    Icons.close,
                    size: 12,
                    color: AppColors.outline,
                  ),
                ),
              ],
            ),
          ),
        ],
        // Nút tròn chứa linh vật 3D nền Teal đậm chuẩn nhận diện Lambe
        Container(
          width: 74,
          height: 74,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xFF12998B),
                Color(0xFF095A50),
                Color(0xFF023E37),
              ],
            ),
            border: Border.all(
              color: const Color(0xFF5EEAD4).withValues(alpha: 0.65),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF005C55).withValues(alpha: 0.35),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
              BoxShadow(
                color: const Color(0xFF14B8A6).withValues(alpha: 0.20),
                blurRadius: 8,
              ),
            ],
          ),
          child: ClipOval(
            child: LambeMascot(
              size: 68,
              showShadow: false,
              enableInteraction: true,
              onTap: widget.onTap ?? () => _showDefaultAssistantDialog(context),
            ),
          ),
        ),
      ],
    );
  }

  void _showDefaultAssistantDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            // Linh vật 3D kích thước lớn trong popup
            const LambeMascot(
              size: 140,
              showShadow: true,
              enableInteraction: true,
            ),
            const SizedBox(height: 12),
            const Text(
              'Lambe AI Assistant',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Xin chào! Em là trợ lý thông minh của Lambe. Em có thể tư vấn mẫu móng, kiểu tóc phù hợp hoặc giải đáp các thắc mắc dịch vụ cho bạn!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.onSurfaceVariant,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Tính năng trò chuyện AI đang được kết nối.')),
                );
              },
              icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
              label: const Text('Bắt đầu trò chuyện'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/widgets/mascot/lambe_mascot.dart';

/// Widget linh vật Chatbot AI 3D nổi ở góc dưới bên phải màn hình.
///
/// Tối ưu hiệu suất:
/// - Loại bỏ AnimationController pulse thừa (hào quang giờ dùng CSS-like
///   hiệu ứng tĩnh thay vì animation loop riêng)
/// - Chỉ render 1 instance LambeMascot tại 1 thời điểm
///   (FAB bị ẩn khi mở bottom sheet)
class HomeChatbotMascotFab extends StatefulWidget {
  final VoidCallback? onChatTap;

  const HomeChatbotMascotFab({
    super.key,
    this.onChatTap,
  });

  @override
  State<HomeChatbotMascotFab> createState() => _HomeChatbotMascotFabState();
}

class _HomeChatbotMascotFabState extends State<HomeChatbotMascotFab> {
  bool _showBubble = true;
  bool _isSheetOpen = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        // 1. Bong bóng chào hỏi "✨ Em ở đây, cần đặt lịch nhanh không ạ?"
        if (_showBubble)
          AnimatedOpacity(
            duration: const Duration(milliseconds: 300),
            opacity: _showBubble ? 1.0 : 0.0,
            child: Container(
              margin: const EdgeInsets.only(bottom: 8, right: 4),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              constraints: const BoxConstraints(maxWidth: 220),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainerLowest.withValues(alpha: 0.95),
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
                  const Flexible(
                    child: Text(
                      '✨ Em ở đây, cần đặt lịch nhanh không ạ?',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface,
                        height: 1.3,
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

        // 2. Nút tròn chứa linh vật 3D, đèn xanh online
        GestureDetector(
          onTap: widget.onChatTap ?? () => _showAssistantSheet(context),
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              // Hào quang tĩnh ngọc lục bảo — dùng gradient + boxShadow
              // thay vì AnimationController riêng (tiết kiệm 1 animation loop)
              Container(
                width: 78,
                height: 78,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF14B8A6).withValues(alpha: 0.30),
                      blurRadius: 22,
                      spreadRadius: 4,
                    ),
                  ],
                ),
              ),

              // Vòng tròn chứa linh vật 3D với màu nền Teal đậm chuẩn nhận diện Lambe
              Container(
                width: 74,
                height: 74,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      Color(0xFF12998B), // Ngọc lam trung tính ở góc trên
                      Color(0xFF095A50), // Teal đậm thương hiệu Lambe (#005C55)
                      Color(0xFF023E37), // Deep Dark Forest Teal ở đáy
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
                  child: Center(
                    child: LambeMascot(
                      size: 68,
                      showShadow: false,
                      enableInteraction: true,
                      isPlaying: !_isSheetOpen,
                    ),
                  ),
                ),
              ),

              // Đèn xanh online ở góc dưới phải (Green dot)
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
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _showAssistantSheet(BuildContext context) async {
    setState(() => _isSheetOpen = true);
    try {
      await showModalBottomSheet(
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
            // Khung vũ trụ chứa linh vật 3D nổi bật
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(22),
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Color(0xFF040814),
                    Color(0xFF0D1B2A),
                    Color(0xFF081220),
                  ],
                ),
                border: Border.all(
                  color: const Color(0xFF38E1E7).withValues(alpha: 0.5),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF38E1E7).withValues(alpha: 0.2),
                    blurRadius: 16,
                  ),
                ],
              ),
              child: const Center(
                child: LambeMascot(
                  size: 140,
                  showShadow: false,
                  enableInteraction: true,
                ),
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Trợ Lý Sắc Đẹp Lambe AI',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Em có thể giúp chị tìm chuyên viên gần nhất, gợi ý mẫu móng hot trend hoặc kiểm tra bảng giá dịch vụ làm đẹp tại nhà!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.onSurfaceVariant,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 18),
            // Các nút gợi ý nhanh
            Wrap(
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                _buildQuickAction(ctx, '✨ Tìm chuyên viên gần tôi nhất'),
                _buildQuickAction(ctx, '💅 Gợi ý mẫu Nail Gel'),
                _buildQuickAction(ctx, '💆‍♀️ Đặt gội đầu dưỡng sinh'),
              ],
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Tính năng trò chuyện trực tiếp với AI đang kết nối.'),
                  ),
                );
              },
              icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
              label: const Text('Bắt đầu trò chuyện với AI'),
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
    } finally {
      if (mounted) {
        setState(() => _isSheetOpen = false);
      }
    }
  }

  Widget _buildQuickAction(BuildContext ctx, String label) {
    return InkWell(
      onTap: () {
        Navigator.pop(ctx);
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(content: Text('Đang xử lý: $label')),
        );
      },
      borderRadius: BorderRadius.circular(100),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerLow,
          borderRadius: BorderRadius.circular(100),
          border: Border.all(color: AppColors.surfaceContainer),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: AppColors.primary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

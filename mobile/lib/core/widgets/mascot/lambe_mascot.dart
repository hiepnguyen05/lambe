import 'package:flutter/material.dart';
import 'package:mobile/core/widgets/mascot/controllers/mascot_animation_controller.dart';
import 'package:mobile/core/widgets/mascot/math/mascot_sparkle_particle.dart';
import 'package:mobile/core/widgets/mascot/painters/mascot_3d_painter.dart';

/// Widget Linh vật Chatbot AI 3D của Lambe Beauty Assistant
///
/// Tối ưu hiệu suất:
/// - Dùng [ListenableBuilder] + [RepaintBoundary] để chỉ repaint CustomPaint
///   mà KHÔNG rebuild toàn bộ widget tree mỗi frame (60 FPS)
/// - Hỗ trợ [setPlaying] để tạm dừng animation khi bị ẩn
///
/// Hỗ trợ:
/// - Chuyển động bay bồng bềnh hình sin mượt mà 60/120 FPS
/// - Chớp mắt tự nhiên theo chu kỳ ngẫu nhiên
/// - Đôi cánh vẫy nhịp nhàng & viên đá quý ngọc lam xoay 3D
/// - 14 hạt sao vàng lấp lánh bay quanh quỹ đạo có chiều sâu
/// - Tương tác chạm/vuốt: Robot quay đầu và dõi mắt theo ngón tay
class LambeMascot extends StatefulWidget {
  /// Kích thước hiển thị (vuông)
  final double size;

  /// Bật/tắt tương tác xoay đầu theo cử chỉ chạm/vuốt
  final bool enableInteraction;

  /// Bật/tắt bóng đổ dưới chân
  final bool showShadow;

  /// Bật/tắt các hạt sao lấp lánh xung quanh
  final bool showSparkles;

  /// Bật/tắt chạy hoạt ảnh (pause khi bị che hoặc ngoài viewport)
  final bool isPlaying;

  /// Callback khi người dùng chạm vào linh vật
  final VoidCallback? onTap;

  const LambeMascot({
    super.key,
    this.size = 120.0,
    this.enableInteraction = true,
    this.showShadow = true,
    this.showSparkles = true,
    this.isPlaying = true,
    this.onTap,
  });

  @override
  State<LambeMascot> createState() => _LambeMascotState();
}

class _LambeMascotState extends State<LambeMascot>
    with SingleTickerProviderStateMixin {
  late final MascotAnimationController _controller;
  late final List<MascotSparkleParticle> _sparkles;

  @override
  void initState() {
    super.initState();
    _sparkles = MascotSparkleParticle.generateDefaultSparkles();
    _controller = MascotAnimationController(vsync: this);
    if (!widget.isPlaying) {
      _controller.setPlaying(false);
    }
  }

  @override
  void didUpdateWidget(covariant LambeMascot oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isPlaying != widget.isPlaying) {
      _controller.setPlaying(widget.isPlaying);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handlePointerUpdate(Offset localPosition) {
    if (!widget.enableInteraction) return;
    // Chuẩn hoá toạ độ từ [0, size] sang [-1.0, 1.0]
    final normX = ((localPosition.dx / widget.size) * 2.0 - 1.0).clamp(
      -1.0,
      1.0,
    );
    final normY = ((localPosition.dy / widget.size) * 2.0 - 1.0).clamp(
      -1.0,
      1.0,
    );
    _controller.updatePointer(normX, normY);
  }

  void _handlePointerReset() {
    if (!widget.enableInteraction) return;
    _controller.updatePointer(0.0, 0.0);
  }

  @override
  Widget build(BuildContext context) {
    // ListenableBuilder chỉ rebuild CustomPaint bên trong,
    // KHÔNG rebuild GestureDetector/MouseRegion/SizedBox bên ngoài.
    Widget content = SizedBox(
      width: widget.size,
      height: widget.size,
      child: RepaintBoundary(
        child: ListenableBuilder(
          listenable: _controller,
          builder: (context, _) {
            return CustomPaint(
              size: Size(widget.size, widget.size),
              painter: Mascot3DPainter(
                controller: _controller,
                sparkles: _sparkles,
                showShadow: widget.showShadow,
                showSparkles: widget.showSparkles,
              ),
            );
          },
        ),
      ),
    );

    if (widget.enableInteraction || widget.onTap != null) {
      content = GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          _controller.triggerNextAction();
          widget.onTap?.call();
        },
        onPanUpdate: widget.enableInteraction
            ? (details) => _handlePointerUpdate(details.localPosition)
            : null,
        onPanEnd: widget.enableInteraction
            ? (_) => _handlePointerReset()
            : null,
        onPanCancel: widget.enableInteraction
            ? _handlePointerReset
            : null,
        child: widget.enableInteraction
            ? MouseRegion(
                onHover: (event) => _handlePointerUpdate(event.localPosition),
                onExit: (_) => _handlePointerReset(),
                child: content,
              )
            : content,
      );
    }

    return content;
  }
}

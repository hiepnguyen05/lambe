import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../math/vector3d.dart';

/// Họa sĩ vẽ thân robot tròn trịa trắng sứ và vòng thắt lưng vàng kim phát sáng
/// Tuyệt đối chuẩn theo mẫu: KHÔNG có vòng cổ màu xanh, thân nối tự nhiên, vòng eo vàng rực rỡ!
class BodyAndRingsPainter {
  static final Paint _torsoPaint = Paint()..isAntiAlias = true;
  static final Paint _waistPaint = Paint()..isAntiAlias = true;

  /// Vẽ thân robot quả lê/người tuyết trắng sứ mềm mại
  static void drawTorso({
    required Canvas canvas,
    required Offset center,
    required double scale,
    required double rotX,
    required double rotY,
    required double rotZ,
  }) {
    // Vị trí tâm thân: (0, -0.36, 0)
    final bodyPoint = const Vector3D(0, -0.36, 0).rotate(rotX, rotY, rotZ);
    final projected = bodyPoint.project(center: center, scale: scale);

    final radiusX = 0.44 * scale * projected.scale;
    final radiusY = 0.52 * scale * projected.scale;

    // Gradient tạo hình cầu sứ trắng nổi khối 3D mềm mại
    final lightOffset = Offset(
      projected.offset.dx - 0.15 * radiusX,
      projected.offset.dy - 0.20 * radiusY,
    );

    _torsoPaint.shader = RadialGradient(
      center: Alignment(
        (lightOffset.dx - projected.offset.dx) / radiusX,
        (lightOffset.dy - projected.offset.dy) / radiusY,
      ),
      radius: 1.15,
      colors: const [
        Color(0xFFFFFFFF), // Đỉnh sáng trắng tinh
        Color(0xFFFFFFFF), // Thân trắng sứ
        Color(0xFFF1F5F9), // Chuyển màu nhẹ
        Color(0xFFCBD5E1), // Vùng đổ bóng mềm
      ],
      stops: const [0.0, 0.45, 0.8, 1.0],
    ).createShader(Rect.fromCenter(
      center: projected.offset,
      width: radiusX * 2,
      height: radiusY * 2,
    ));

    canvas.drawOval(
      Rect.fromCenter(
        center: projected.offset,
        width: radiusX * 2,
        height: radiusY * 2,
      ),
      _torsoPaint,
    );

    // Điểm bóng sáng bề mặt
    final glintPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.85)
      ..style = PaintingStyle.fill;
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(
          projected.offset.dx - 0.14 * radiusX,
          projected.offset.dy - 0.18 * radiusY,
        ),
        width: radiusX * 0.32,
        height: radiusY * 0.22,
      ),
      glintPaint,
    );
  }

  /// Vẽ vòng eo Vàng ánh kim (vòng nhẫn duy nhất quanh eo như hình mẫu)
  static void drawWaistRing({
    required Canvas canvas,
    required Offset center,
    required double scale,
    required double rotX,
    required double rotY,
    required double rotZ,
    required bool isFront,
  }) {
    // Vòng eo ở y = -0.36
    final waistPoint = const Vector3D(0, -0.36, 0).rotate(rotX, rotY, rotZ);
    final projected = waistPoint.project(center: center, scale: scale);

    final rX = 0.45 * scale * projected.scale;
    final rY = (0.10 + math.sin(rotX).abs() * 0.12) * scale * projected.scale;

    _waistPaint.shader = const LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Color(0xFFFFF59D), // Vàng kim sáng rực
        Color(0xFFFFD600), // Vàng neon chính xác
        Color(0xFFFFAB00), // Vàng cam ấm
      ],
    ).createShader(Rect.fromCenter(
      center: projected.offset,
      width: rX * 2,
      height: rY * 2,
    ));
    _waistPaint.style = PaintingStyle.stroke;
    _waistPaint.strokeWidth = 5.0 * (scale / 70.0);
    _waistPaint.strokeCap = StrokeCap.round;

    final sweepAngle = isFront ? math.pi : -math.pi;
    final startAngle = isFront ? 0.0 : math.pi;

    canvas.drawArc(
      Rect.fromCenter(
        center: projected.offset,
        width: rX * 2,
        height: rY * 2,
      ),
      startAngle,
      sweepAngle,
      false,
      _waistPaint,
    );
  }
}

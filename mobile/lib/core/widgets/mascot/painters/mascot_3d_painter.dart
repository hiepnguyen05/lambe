import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../controllers/mascot_animation_controller.dart';
import '../math/mascot_sparkle_particle.dart';
import '../math/vector3d.dart';
import 'parts/antenna_painter.dart';
import 'parts/body_and_rings_painter.dart';
import 'parts/head_and_face_painter.dart';
import 'parts/wings_and_ears_painter.dart';

/// Họa sĩ trưởng điều phối toàn bộ mô hình 3D linh vật và sắp xếp chiều sâu Z-Order
/// Chuẩn xác 100% theo mẫu thiết kế hình ảnh người dùng cung cấp
class Mascot3DPainter extends CustomPainter {
  final MascotAnimationController controller;
  final List<MascotSparkleParticle> sparkles;
  final bool showShadow;
  final bool showSparkles;

  Mascot3DPainter({
    required this.controller,
    required this.sparkles,
    this.showShadow = true,
    this.showSparkles = true,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    // Tỉ lệ scale chuẩn hoá: 1.0 đơn vị Three.js
    final baseScale = math.min(size.width, size.height) * 0.38;

    // Toạ độ bay hình sin + bước nhảy nhấp nhô (Jump)
    final flightOffset = Offset(
      controller.flyX * baseScale * 0.35,
      -(controller.flyY + controller.jumpOffsetY) * baseScale * 0.35,
    );
    final botCenter = center + flightOffset;

    // Góc xoay tổng hợp: X (Pitch), Y (Yaw + 360° Spin), Z (Roll do bay nghiêng)
    final totalRotX = controller.rotX;
    final totalRotY = controller.rotY + controller.spinRotY;
    final totalRotZ = controller.flightBank;

    // 1. Vẽ bóng đổ bồng bềnh dưới sàn (nếu bật)
    if (showShadow) {
      _drawDropShadow(canvas, center, baseScale);
    }

    // 2. Phân loại hạt sao vàng lấp lánh (Sparkles)
    final projectedSparkles = <_SparkleRenderData>[];
    if (showSparkles) {
      for (final s in sparkles) {
        final pos3d = s.getPosition(controller.elapsedTime);
        final projected = pos3d.project(center: botCenter, scale: baseScale);
        projectedSparkles.add(_SparkleRenderData(
          point: projected,
          particle: s,
        ));
      }
    }

    // Vẽ sao ở tầng sâu phía sau (Z < 0)
    if (showSparkles) {
      for (final sp in projectedSparkles.where((d) => d.point.depth < 0)) {
        _drawSingleSparkle(canvas, sp);
      }
    }

    // 3. Vẽ nửa sau của vòng eo vàng (nằm sau thân)
    BodyAndRingsPainter.drawWaistRing(
      canvas: canvas,
      center: botCenter,
      scale: baseScale,
      rotX: totalRotX,
      rotY: totalRotY,
      rotZ: totalRotZ,
      isFront: false,
    );

    // 4. Vẽ đôi bàn tay múp míp trắng vẫy nhẹ (hỗ trợ vẫy tay chào)
    WingsAndEarsPainter.drawWings(
      canvas: canvas,
      center: botCenter,
      scale: baseScale,
      rotX: totalRotX,
      rotY: totalRotY,
      rotZ: totalRotZ,
      leftWingFlapZ: controller.leftHandRotZ,
      rightWingFlapZ: controller.rightHandRotZ,
      rightHandRaiseY: controller.rightHandRaiseY,
      rightHandWaveAngle: controller.rightHandWaveAngle,
    );

    // 5. Vẽ thân hình quả lê trắng sứ
    BodyAndRingsPainter.drawTorso(
      canvas: canvas,
      center: botCenter,
      scale: baseScale,
      rotX: totalRotX,
      rotY: totalRotY,
      rotZ: totalRotZ,
    );

    // 6. Vẽ nửa trước của vòng eo vàng kim (nằm trước thân)
    BodyAndRingsPainter.drawWaistRing(
      canvas: canvas,
      center: botCenter,
      scale: baseScale,
      rotX: totalRotX,
      rotY: totalRotY,
      rotZ: totalRotZ,
      isFront: true,
    );

    // 7. Vẽ mũ bảo hiểm Cyan phát sáng
    HeadAndFacePainter.drawHelmet(
      canvas: canvas,
      center: botCenter,
      scale: baseScale,
      rotX: totalRotX,
      rotY: totalRotY,
      rotZ: totalRotZ,
    );

    // 8. Vẽ tai nghe vàng neon 2 bên mũ
    WingsAndEarsPainter.drawEars(
      canvas: canvas,
      center: botCenter,
      scale: baseScale,
      rotX: totalRotX,
      rotY: totalRotY,
      rotZ: totalRotZ,
    );

    // 9. Vẽ mặt trắng sứ cùng vệt bóng kính phản chiếu ánh sáng
    HeadAndFacePainter.drawFacePlate(
      canvas: canvas,
      center: botCenter,
      scale: baseScale,
      rotX: totalRotX,
      rotY: totalRotY,
      rotZ: totalRotZ,
    );

    // 10. Vẽ mắt xanh lam sâu thẳm, sao trán và má hồng đào to tròn
    HeadAndFacePainter.drawEyesAndCheeks(
      canvas: canvas,
      center: botCenter,
      scale: baseScale,
      rotX: totalRotX,
      rotY: totalRotY,
      rotZ: totalRotZ,
      eyeScaleY: controller.eyeScaleY,
    );

    // 11. Vẽ ăng-ten sừng vàng & viên ngọc tròn xanh ngọc lam
    AntennaPainter.drawAntenna(
      canvas: canvas,
      center: botCenter,
      scale: baseScale,
      rotX: totalRotX,
      rotY: totalRotY,
      rotZ: totalRotZ,
      leafRotZ: controller.leafRotZ,
      gemRotY: controller.gemRotY,
    );

    // 12. Vẽ các hạt sao vàng ở tầng nổi phía trước (Z >= 0)
    if (showSparkles) {
      for (final sp in projectedSparkles.where((d) => d.point.depth >= 0)) {
        _drawSingleSparkle(canvas, sp);
      }
    }
  }

  /// Vẽ bóng đổ mềm mại dưới chân
  void _drawDropShadow(Canvas canvas, Offset center, double baseScale) {
    final shadowY = center.dy + baseScale * 0.82;
    final altitudeFactor = 1.0 - (controller.flyY * 0.4);
    final shadowWidth = baseScale * 0.65 * altitudeFactor;
    final shadowHeight = baseScale * 0.15 * altitudeFactor;

    final shadowPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.15 * altitudeFactor)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7);

    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(center.dx + controller.flyX * baseScale * 0.25, shadowY),
        width: shadowWidth,
        height: shadowHeight,
      ),
      shadowPaint,
    );
  }

  /// Vẽ hạt sao vàng kim lấp lánh như trên nền trời vũ trụ
  void _drawSingleSparkle(Canvas canvas, _SparkleRenderData sp) {
    final offset = sp.point.offset;
    final sz = sp.particle.size * sp.point.scale;
    final opacity = ((sp.point.depth + 1.2) / 2.4).clamp(0.35, 1.0);

    final sparklePaint = Paint()
      ..color = const Color(0xFFFFE066).withValues(alpha: opacity)
      ..style = PaintingStyle.fill;

    // Hạt sao 4 cánh nhọn
    final path = Path()
      ..moveTo(offset.dx, offset.dy - sz)
      ..lineTo(offset.dx + sz * 0.32, offset.dy)
      ..lineTo(offset.dx, offset.dy + sz)
      ..lineTo(offset.dx - sz * 0.32, offset.dy)
      ..close();

    canvas.drawPath(path, sparklePaint);

    final pathH = Path()
      ..moveTo(offset.dx - sz, offset.dy)
      ..lineTo(offset.dx, offset.dy + sz * 0.32)
      ..lineTo(offset.dx + sz, offset.dy)
      ..lineTo(offset.dx, offset.dy - sz * 0.32)
      ..close();

    canvas.drawPath(pathH, sparklePaint);

    // Lõi sáng trắng ở tâm
    final centerCore = Paint()
      ..color = Colors.white.withValues(alpha: opacity);
    canvas.drawCircle(offset, sz * 0.30, centerCore);
  }

  @override
  bool shouldRepaint(covariant Mascot3DPainter oldDelegate) => true;
}

class _SparkleRenderData {
  final ProjectedPoint point;
  final MascotSparkleParticle particle;

  _SparkleRenderData({
    required this.point,
    required this.particle,
  });
}

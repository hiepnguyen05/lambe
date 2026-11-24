import 'package:flutter/material.dart';
import 'package:mobile/core/widgets/mascot/math/vector3d.dart';

/// Họa sĩ vẽ:
/// 1. Tai nghe vàng neon hai bên mũ bảo hiểm (dạng capsule/trụ tròn bo góc đúng như hình mẫu)
/// 2. Đôi tay múp míp trắng sứ lơ lửng hai bên hông vẫy nhẹ trong không gian
class WingsAndEarsPainter {
  static final Paint _earPaint = Paint()..isAntiAlias = true;
  static final Paint _handPaint = Paint()..isAntiAlias = true;

  /// Vẽ tai nghe đối xứng 2 bên đầu
  static void drawEars({
    required Canvas canvas,
    required Offset center,
    required double scale,
    required double rotX,
    required double rotY,
    required double rotZ,
  }) {
    // Vị trí tai nghe: bám sát rìa mũ bảo hiểm lớn hơn (±0.70, 0.42, 0)
    final leftEarVec = const Vector3D(-0.70, 0.42, 0).rotate(rotX, rotY, rotZ);
    final rightEarVec = const Vector3D(0.70, 0.42, 0).rotate(rotX, rotY, rotZ);

    final pLeft = leftEarVec.project(center: center, scale: scale);
    final pRight = rightEarVec.project(center: center, scale: scale);

    final earW = 0.10 * scale * pLeft.scale;
    final earH = 0.22 * scale * pLeft.scale;

    _earPaint.shader =
        const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFFFFF59D), // Đỉnh vàng sáng
            Color(0xFFFFD600), // Vàng neon rực rỡ
            Color(0xFFFFAB00), // Vùng bóng vàng cam
          ],
        ).createShader(
          Rect.fromCenter(center: pLeft.offset, width: earW, height: earH),
        );

    // Tai trái: Capsule bo tròn
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: pLeft.offset, width: earW, height: earH),
        const Radius.circular(5),
      ),
      _earPaint,
    );

    // Tai phải: Capsule bo tròn
    _earPaint.shader =
        const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFFFF59D), Color(0xFFFFD600), Color(0xFFFFAB00)],
        ).createShader(
          Rect.fromCenter(center: pRight.offset, width: earW, height: earH),
        );

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromCenter(center: pRight.offset, width: earW, height: earH),
        const Radius.circular(5),
      ),
      _earPaint,
    );
  }

  /// Vẽ đôi bàn tay tròn trịa trắng sứ lơ lửng 2 bên thân (hỗ trợ vẫy tay chào)
  static void drawWings({
    required Canvas canvas,
    required Offset center,
    required double scale,
    required double rotX,
    required double rotY,
    required double rotZ,
    required double leftWingFlapZ,
    required double rightWingFlapZ,
    double rightHandRaiseY = 0.0,
    double rightHandWaveAngle = 0.0,
  }) {
    // Tay trái: (-0.59, -0.26, 0.14)
    final leftPos = const Vector3D(-0.59, -0.26, 0.14).rotate(rotX, rotY, rotZ);
    // Tay phải: khi vẫy tay nâng cao lên (0.59, -0.26 + rightHandRaiseY, 0.14)
    final rightPos = Vector3D(
      0.59,
      -0.26 + rightHandRaiseY,
      0.14,
    ).rotate(rotX, rotY, rotZ);

    final pLeft = leftPos.project(center: center, scale: scale);
    final pRight = rightPos.project(center: center, scale: scale);

    // Đôi bàn tay to tròn múp míp hơn
    final handW = 0.21 * scale * pLeft.scale;
    final handH = 0.30 * scale * pLeft.scale;

    _handPaint.shader =
        RadialGradient(
          center: const Alignment(-0.2, -0.3),
          colors: const [
            Color(0xFFFFFFFF),
            Color(0xFFFFFFFF),
            Color(0xFFF1F5F9),
            Color(0xFFCBD5E1),
          ],
          stops: const [0.0, 0.5, 0.85, 1.0],
        ).createShader(
          Rect.fromCenter(center: pLeft.offset, width: handW, height: handH),
        );

    // Tay trái (nghiêng chếch ra ngoài và hướng lên một chút)
    canvas.save();
    canvas.translate(pLeft.offset.dx, pLeft.offset.dy);
    canvas.rotate(-0.35 + leftWingFlapZ * 0.4);
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: handW, height: handH),
      _handPaint,
    );
    canvas.restore();

    // Tay phải: khi vẫy tay thêm góc lắc rightHandWaveAngle
    _handPaint.shader =
        RadialGradient(
          center: const Alignment(0.2, -0.3),
          colors: const [
            Color(0xFFFFFFFF),
            Color(0xFFFFFFFF),
            Color(0xFFF1F5F9),
            Color(0xFFCBD5E1),
          ],
          stops: const [0.0, 0.5, 0.85, 1.0],
        ).createShader(
          Rect.fromCenter(center: pRight.offset, width: handW, height: handH),
        );

    canvas.save();
    canvas.translate(pRight.offset.dx, pRight.offset.dy);
    canvas.rotate(0.35 + rightWingFlapZ * 0.4 + rightHandWaveAngle);
    canvas.drawOval(
      Rect.fromCenter(center: Offset.zero, width: handW, height: handH),
      _handPaint,
    );
    canvas.restore();
  }
}

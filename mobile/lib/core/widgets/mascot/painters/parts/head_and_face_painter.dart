import 'package:flutter/material.dart';
import 'package:mobile/core/widgets/mascot/math/vector3d.dart';

/// Họa sĩ vẽ đầu phi hành gia chibi:
/// - Mũ bảo hiểm viền Cyan/Turquoise phát sáng (#38E1E7)
/// - Vệt bóng kính phản chiếu ánh sáng (Visor Glass Reflection)
/// - Khuôn mặt trắng sứ tròn xoe (#FFFFFF)
/// - Đôi mắt oval xanh lam sâu thẳm (#0284C7) chớp mắt mượt mà
/// - Đốm sao vàng nhỏ giữa trán (#FFE066)
/// - Đôi má hồng đào rực rỡ siêu dễ thương (#FF7597)
class HeadAndFacePainter {
  static final Paint _helmetRimPaint = Paint()..isAntiAlias = true;
  static final Paint _facePaint = Paint()..isAntiAlias = true;
  static final Paint _eyePaint = Paint()..isAntiAlias = true;
  static final Paint _blushPaint = Paint()..isAntiAlias = true;

  /// Vẽ mũ bảo hiểm Cyan và vòm kính
  static void drawHelmet({
    required Canvas canvas,
    required Offset center,
    required double scale,
    required double rotX,
    required double rotY,
    required double rotZ,
  }) {
    // Vị trí tâm đầu: (0, 0.42, 0)
    final headPoint = const Vector3D(0, 0.42, 0).rotate(rotX, rotY, rotZ);
    final projected = headPoint.project(center: center, scale: scale);

    final rX = 0.68 * scale * projected.scale;
    final rY = 0.63 * scale * projected.scale;

    // 1. Nền vỏ mũ bảo hiểm Cyan sáng rực rỡ
    _helmetRimPaint.shader =
        RadialGradient(
          center: const Alignment(-0.25, -0.35),
          radius: 1.15,
          colors: const [
            Color(0xFFA5F3FC), // Đỉnh sáng trắng ngọc
            Color(0xFF38E1E7), // Màu Cyan/Turquoise neon chính xác
            Color(0xFF22D3EE), // Vùng giữa tươi sáng
            Color(0xFF0891B2), // Đổ bóng viền ngoài
          ],
          stops: const [0.0, 0.35, 0.75, 1.0],
        ).createShader(
          Rect.fromCenter(
            center: projected.offset,
            width: rX * 2,
            height: rY * 2,
          ),
        );

    canvas.drawOval(
      Rect.fromCenter(center: projected.offset, width: rX * 2, height: rY * 2),
      _helmetRimPaint,
    );
  }

  /// Vẽ khuôn mặt trắng sứ đặt bên trong vòm kính
  static void drawFacePlate({
    required Canvas canvas,
    required Offset center,
    required double scale,
    required double rotX,
    required double rotY,
    required double rotZ,
  }) {
    // Mặt sứ: nhô về phía trước (0, 0.41, 0.16)
    final facePoint = const Vector3D(0, 0.41, 0.16).rotate(rotX, rotY, rotZ);
    final projected = facePoint.project(center: center, scale: scale);

    final rX = 0.45 * scale * projected.scale;
    final rY = 0.41 * scale * projected.scale;

    // Khuôn mặt trắng tinh khôi với bóng nhẹ
    _facePaint.shader =
        RadialGradient(
          center: const Alignment(-0.2, -0.3),
          radius: 1.05,
          colors: const [
            Color(0xFFFFFFFF),
            Color(0xFFFFFFFF),
            Color(0xFFF8FAFC),
            Color(0xFFE2E8F0),
          ],
          stops: const [0.0, 0.6, 0.88, 1.0],
        ).createShader(
          Rect.fromCenter(
            center: projected.offset,
            width: rX * 2,
            height: rY * 2,
          ),
        );

    canvas.drawOval(
      Rect.fromCenter(center: projected.offset, width: rX * 2, height: rY * 2),
      _facePaint,
    );

    // 2. Vệt bóng kính phản chiếu ánh sáng trên trán bên phải (như ảnh vẽ mẫu)
    // Tọa độ tính theo bán kính mũ bảo hiểm để nổi bật rõ ràng trên nền Cyan
    final rHX = 0.68 * scale * projected.scale;
    final rHY = 0.63 * scale * projected.scale;

    final glassShinePaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.96)
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    canvas.save();
    canvas.translate(projected.offset.dx, projected.offset.dy);

    // Vệt sáng cong hình trăng khuyết mềm mại trên trán bên phải
    final shinePath = Path();
    shinePath.moveTo(rHX * 0.14, -rHY * 0.84);
    // Vòng cung ngoài men theo rìa trên bên phải của mũ bảo hiểm
    shinePath.cubicTo(
      rHX * 0.50,
      -rHY * 0.86,
      rHX * 0.84,
      -rHY * 0.62,
      rHX * 0.84,
      -rHY * 0.22,
    );
    // Bo tròn mềm mại ở đầu dưới
    shinePath.quadraticBezierTo(
      rHX * 0.82,
      -rHY * 0.12,
      rHX * 0.72,
      -rHY * 0.18,
    );
    // Vòng cung trong men theo đường tiếp giáp trán
    shinePath.cubicTo(
      rHX * 0.66,
      -rHY * 0.44,
      rHX * 0.42,
      -rHY * 0.66,
      rHX * 0.15,
      -rHY * 0.70,
    );
    // Bo tròn mềm mại ở đầu trên
    shinePath.quadraticBezierTo(
      rHX * 0.08,
      -rHY * 0.78,
      rHX * 0.14,
      -rHY * 0.84,
    );
    shinePath.close();

    canvas.drawPath(shinePath, glassShinePaint);

    // Đốm sáng phụ nhỏ xinh ở phía dưới vệt sáng chính tạo độ bóng kính 3D
    final smallShine = Paint()
      ..color = Colors.white.withValues(alpha: 0.92)
      ..style = PaintingStyle.fill
      ..isAntiAlias = true;

    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(rHX * 0.78, -rHY * 0.06),
        width: rHX * 0.09,
        height: rHY * 0.14,
      ),
      smallShine,
    );
    canvas.restore();
  }

  /// Vẽ mắt oval to tròn xanh lam dễ thương, đốm trán vàng & má hồng đào
  static void drawEyesAndCheeks({
    required Canvas canvas,
    required Offset center,
    required double scale,
    required double rotX,
    required double rotY,
    required double rotZ,
    required double eyeScaleY,
  }) {
    // 1. Đốm sao vàng nhỏ giữa trán: (0, 0.52, 0.48)
    final starVec = const Vector3D(0, 0.52, 0.48).rotate(rotX, rotY, rotZ);
    final pStar = starVec.project(center: center, scale: scale);
    final starPaint = Paint()
      ..color = const Color(0xFFFFE066)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(pStar.offset, 0.025 * scale * pStar.scale, starPaint);

    // 2. Mắt trái (-0.17, 0.43, 0.58) & Mắt phải (0.17, 0.43, 0.58)
    final leftEyeVec = const Vector3D(
      -0.17,
      0.43,
      0.58,
    ).rotate(rotX, rotY, rotZ);
    final rightEyeVec = const Vector3D(
      0.17,
      0.43,
      0.58,
    ).rotate(rotX, rotY, rotZ);

    final pLeftEye = leftEyeVec.project(center: center, scale: scale);
    final pRightEye = rightEyeVec.project(center: center, scale: scale);

    // Mắt to tròn long lanh đáng yêu chuẩn phong cách chibi
    final eyeW = 0.16 * scale * pLeftEye.scale;
    final eyeH = (0.22 * eyeScaleY) * scale * pLeftEye.scale;

    _eyePaint.color = const Color(0xFF0284C7);
    _eyePaint.style = PaintingStyle.fill;

    // Vẽ mắt trái
    canvas.drawOval(
      Rect.fromCenter(center: pLeftEye.offset, width: eyeW, height: eyeH),
      _eyePaint,
    );
    // Điểm sáng trong mắt trái nếu đang mở
    if (eyeScaleY > 0.3) {
      final glint = Paint()..color = Colors.white.withValues(alpha: 0.95);
      // Điểm sáng chính to tròn
      canvas.drawCircle(
        Offset(
          pLeftEye.offset.dx + eyeW * 0.16,
          pLeftEye.offset.dy - eyeH * 0.20,
        ),
        eyeW * 0.26,
        glint,
      );
      // Điểm sáng phụ nhỏ xinh tạo độ long lanh
      final smallGlint = Paint()..color = Colors.white.withValues(alpha: 0.75);
      canvas.drawCircle(
        Offset(
          pLeftEye.offset.dx - eyeW * 0.14,
          pLeftEye.offset.dy + eyeH * 0.20,
        ),
        eyeW * 0.13,
        smallGlint,
      );
    }

    // Vẽ mắt phải
    canvas.drawOval(
      Rect.fromCenter(center: pRightEye.offset, width: eyeW, height: eyeH),
      _eyePaint,
    );
    // Điểm sáng trong mắt phải
    if (eyeScaleY > 0.3) {
      final glint = Paint()..color = Colors.white.withValues(alpha: 0.95);
      // Điểm sáng chính to tròn
      canvas.drawCircle(
        Offset(
          pRightEye.offset.dx + eyeW * 0.16,
          pRightEye.offset.dy - eyeH * 0.20,
        ),
        eyeW * 0.26,
        glint,
      );
      // Điểm sáng phụ nhỏ xinh
      final smallGlint = Paint()..color = Colors.white.withValues(alpha: 0.75);
      canvas.drawCircle(
        Offset(
          pRightEye.offset.dx - eyeW * 0.14,
          pRightEye.offset.dy + eyeH * 0.20,
        ),
        eyeW * 0.13,
        smallGlint,
      );
    }

    // 3. Má hồng đào rực rỡ dưới hai mắt
    final leftBlushVec = const Vector3D(
      -0.25,
      0.32,
      0.56,
    ).rotate(rotX, rotY, rotZ);
    final rightBlushVec = const Vector3D(
      0.25,
      0.32,
      0.56,
    ).rotate(rotX, rotY, rotZ);

    final pLeftBlush = leftBlushVec.project(center: center, scale: scale);
    final pRightBlush = rightBlushVec.project(center: center, scale: scale);

    final blushW = 0.13 * scale * pLeftBlush.scale;
    final blushH = 0.08 * scale * pLeftBlush.scale;

    _blushPaint.color = const Color(0xFFFF7597).withValues(alpha: 0.85);
    _blushPaint.style = PaintingStyle.fill;

    canvas.drawOval(
      Rect.fromCenter(center: pLeftBlush.offset, width: blushW, height: blushH),
      _blushPaint,
    );
    canvas.drawOval(
      Rect.fromCenter(
        center: pRightBlush.offset,
        width: blushW,
        height: blushH,
      ),
      _blushPaint,
    );
  }
}

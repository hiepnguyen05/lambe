import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mobile/core/widgets/mascot/math/vector3d.dart';

/// Họa sĩ vẽ ăng-ten đỉnh đầu:
/// - Chiếc loa/sừng vàng neon (#FFD600) nghiêng nhẹ sang phải
/// - Viên ngọc/đèn tròn màu xanh ngọc lam (#38E1E7 / #00B4D8) gắn ở cạnh trái
/// Y hệt như trong hình ảnh mẫu!
class AntennaPainter {
  static final Paint _hornPaint = Paint()..isAntiAlias = true;
  static final Paint _gemPaint = Paint()..isAntiAlias = true;

  static void drawAntenna({
    required Canvas canvas,
    required Offset center,
    required double scale,
    required double rotX,
    required double rotY,
    required double rotZ,
    required double leafRotZ,
    required double gemRotY,
  }) {
    // Điểm gốc trên đỉnh mũ bảo hiểm lớn hơn: (0, 1.04, 0)
    final rootPos = const Vector3D(0, 1.04, 0).rotate(rotX, rotY, rotZ);
    // Đỉnh sừng loa vát sang phải: (0.04, 1.28, 0)
    final hornPos = const Vector3D(0.04, 1.28, 0).rotate(rotX, rotY, rotZ);
    // Vị trí viên ngọc xanh cạnh trái: (-0.06, 1.22, 0.02)
    final gemPos = const Vector3D(-0.06, 1.22, 0.02).rotate(rotX, rotY, rotZ);

    final pRoot = rootPos.project(center: center, scale: scale);
    final pHorn = hornPos.project(center: center, scale: scale);
    final pGem = gemPos.project(center: center, scale: scale);

    final hornSize = 0.22 * scale * pHorn.scale;

    // 1. Vẽ chiếc sừng/loa vàng rực rỡ
    _hornPaint.shader = const LinearGradient(
      begin: Alignment.bottomLeft,
      end: Alignment.topRight,
      colors: [Color(0xFFFFAB00), Color(0xFFFFD600), Color(0xFFFFF59D)],
    ).createShader(Rect.fromCircle(center: pHorn.offset, radius: hornSize));
    _hornPaint.style = PaintingStyle.fill;

    canvas.save();
    canvas.translate(pRoot.offset.dx, pRoot.offset.dy);
    canvas.rotate(0.18 + math.sin(leafRotZ) * 0.1);

    final hornPath = Path();
    hornPath.moveTo(0, 0);
    // Vát cong mở rộng sang phải hình phễu/sừng
    hornPath.lineTo(hornSize * 0.25, -hornSize * 0.95);
    hornPath.lineTo(hornSize * 0.95, -hornSize * 1.05);
    hornPath.lineTo(hornSize * 0.35, -hornSize * 0.15);
    hornPath.close();

    canvas.drawPath(hornPath, _hornPaint);
    canvas.restore();

    // 2. Vẽ viên ngọc tròn xanh ngọc lam gắn cạnh trái
    final gemRadius = 0.075 * scale * pGem.scale;

    _gemPaint.shader = RadialGradient(
      center: const Alignment(-0.25, -0.3),
      radius: 1.0,
      colors: const [
        Color(0xFFA5F3FC), // Đỉnh sáng trắng ngọc
        Color(0xFF38E1E7), // Màu ngọc lam chính xác
        Color(0xFF0284C7), // Vùng bóng sâu
      ],
    ).createShader(Rect.fromCircle(center: pGem.offset, radius: gemRadius));
    _gemPaint.style = PaintingStyle.fill;

    canvas.drawCircle(pGem.offset, gemRadius, _gemPaint);

    // Điểm bóng sáng trên ngọc
    final shine = Paint()..color = Colors.white.withValues(alpha: 0.9);
    canvas.drawCircle(
      Offset(
        pGem.offset.dx - gemRadius * 0.25,
        pGem.offset.dy - gemRadius * 0.25,
      ),
      gemRadius * 0.3,
      shine,
    );
  }
}

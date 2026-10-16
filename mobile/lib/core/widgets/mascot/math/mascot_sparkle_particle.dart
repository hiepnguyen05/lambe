import 'dart:math' as math;
import 'vector3d.dart';

/// Hạt sao lấp lánh quay theo quỹ đạo 3D xung quanh linh vật
class MascotSparkleParticle {
  final double radius;
  final double height;
  final double baseAngle;
  final double speedMultiplier;
  final double size;

  const MascotSparkleParticle({
    required this.radius,
    required this.height,
    required this.baseAngle,
    required this.speedMultiplier,
    required this.size,
  });

  /// Tạo danh sách 14 hạt sao chuẩn như Three.js
  static List<MascotSparkleParticle> generateDefaultSparkles() {
    final rand = math.Random(42); // Seed cố định để chuyển động mượt mà
    return List.generate(14, (index) {
      final angle = (index / 14.0) * math.pi * 2 + rand.nextDouble() * 0.4;
      final rad = 0.85 + rand.nextDouble() * 0.45;
      final h = (rand.nextDouble() - 0.5) * 1.4;
      final speed = 0.8 + rand.nextDouble() * 0.4;
      final sz = 3.0 + rand.nextDouble() * 2.5;

      return MascotSparkleParticle(
        radius: rad,
        height: h,
        baseAngle: angle,
        speedMultiplier: speed,
        size: sz,
      );
    });
  }

  /// Tính toán toạ độ 3D tại thời điểm t
  Vector3D getPosition(double time) {
    final currentAngle = baseAngle + time * 0.45 * speedMultiplier;
    final x = math.cos(currentAngle) * radius;
    final y = height + math.sin(time * 2.0 + baseAngle) * 0.08;
    final z = math.sin(currentAngle) * radius;
    return Vector3D(x, y, z);
  }
}

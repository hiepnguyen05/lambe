import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Lớp biểu diễn điểm Vector trong không gian 3D và các phép biến đổi hình học
class Vector3D {
  final double x;
  final double y;
  final double z;

  const Vector3D(this.x, this.y, this.z);

  /// Quay quanh trục X (Pitch)
  Vector3D rotateX(double angle) {
    final cosA = math.cos(angle);
    final sinA = math.sin(angle);
    return Vector3D(x, y * cosA - z * sinA, y * sinA + z * cosA);
  }

  /// Quay quanh trục Y (Yaw)
  Vector3D rotateY(double angle) {
    final cosA = math.cos(angle);
    final sinA = math.sin(angle);
    return Vector3D(x * cosA + z * sinA, y, -x * sinA + z * cosA);
  }

  /// Quay quanh trục Z (Roll)
  Vector3D rotateZ(double angle) {
    final cosA = math.cos(angle);
    final sinA = math.sin(angle);
    return Vector3D(x * cosA - y * sinA, x * sinA + y * cosA, z);
  }

  /// Phép quay phối hợp theo thứ tự X, Y, Z
  Vector3D rotate(double rotX, double rotY, double rotZ) {
    return rotateZ(rotZ).rotateY(rotY).rotateX(rotX);
  }

  /// Chiếu phối cảnh (Perspective Projection) lên mặt phẳng 2D Canvas
  ProjectedPoint project({
    required Offset center,
    required double scale,
    double cameraDistance = 4.0,
  }) {
    // Độ sâu perspective
    final zFactor = cameraDistance / (cameraDistance - z);
    final screenX = center.dx + x * scale * zFactor;
    final screenY = center.dy - y * scale * zFactor; // Đảo trục Y màn hình

    return ProjectedPoint(
      offset: Offset(screenX, screenY),
      scale: zFactor,
      depth: z,
    );
  }
}

/// Kết quả chiếu 3D sang toạ độ 2D
class ProjectedPoint {
  final Offset offset;
  final double scale;
  final double depth;

  const ProjectedPoint({
    required this.offset,
    required this.scale,
    required this.depth,
  });
}

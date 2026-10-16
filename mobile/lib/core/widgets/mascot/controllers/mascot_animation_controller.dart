import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/scheduler.dart';

enum MascotAction {
  idle,
  wave, // Vẫy tay chào người dùng
  jump, // Nhảy lên xuống bồng bềnh vui sướng
  spin, // Xoay tròn 360 độ trong không gian 3D
}

/// Controller quản lý hoạt ảnh 3D và các hành động tương tác.
///
/// Extends [ChangeNotifier] để chỉ repaint CustomPaint thông qua
/// [ListenableBuilder] mà KHÔNG rebuild toàn bộ widget tree mỗi frame.
///
/// Hỗ trợ:
/// - Vẫy tay (Hand wave)
/// - Nhảy lên xuống (Bouncing jump)
/// - Xoay vòng 360° (3D yaw spin)
/// - Chớp mắt tự nhiên
/// - Tự động biểu diễn tuần tự hoặc tương tác khi chạm
class MascotAnimationController extends ChangeNotifier {
  late final Ticker _ticker;

  double _elapsedTime = 0.0;
  Duration? _lastElapsed;

  // Trạng thái bay lơ lửng cơ bản
  double flyX = 0.0;
  double flyY = 0.0;
  double flightBank = 0.0;

  // Góc xoay tương tác (Lerp)
  double targetRotX = 0.0;
  double targetRotY = 0.0;
  double rotX = 0.0;
  double rotY = 0.0;

  // Hành động hiện tại
  MascotAction currentAction = MascotAction.idle;
  double _actionStartTime = 0.0;
  double _nextAutoActionTime = 4.0;
  int _actionCycleIndex = 0;

  // Biến điều khiển hành động
  double jumpOffsetY = 0.0;
  double spinRotY = 0.0;
  double rightHandRaiseY = 0.0;
  double rightHandWaveAngle = 0.0;
  double bodySquashScale = 1.0;

  // Đôi cánh/tay vẫy
  double leftHandRotX = 0.0;
  double rightHandRotX = 0.0;
  double leftHandRotZ = 0.0;
  double rightHandRotZ = 0.0;

  // Chớp mắt tự nhiên
  double eyeScaleY = 1.0;
  bool _isBlinking = false;
  double _blinkStartTime = 0.0;
  double _nextBlinkTime = 1.5;
  final math.Random _random = math.Random();

  // Ăng-ten và đá quý
  double leafRotZ = -0.5;
  double gemRotY = 0.0;

  bool _isActive = true;
  bool _isDisposed = false;

  double get elapsedTime => _elapsedTime;

  MascotAnimationController({
    required TickerProvider vsync,
  }) {
    _ticker = vsync.createTicker(_handleTick);
    _ticker.start();
  }

  void _handleTick(Duration elapsed) {
    if (!_isActive || _isDisposed) return;

    if (_lastElapsed == null) {
      _lastElapsed = elapsed;
      return;
    }

    final delta = (elapsed - _lastElapsed!).inMicroseconds / 1000000.0;
    _lastElapsed = elapsed;
    _elapsedTime += delta;

    final t = _elapsedTime;

    // 1. Quỹ đạo bay lơ lửng hình sin tự nhiên
    flyX = math.sin(t * 1.6) * 0.30;
    flyY = math.sin(t * 3.0) * 0.10;
    flightBank = -math.cos(t * 1.6) * 0.15;

    // 2. Nội suy góc xoay tương tác theo con trỏ (Smooth Lerp)
    rotY += (targetRotY - rotY) * 0.08;
    rotX += (targetRotX - rotX) * 0.08;

    // 3. Quản lý trạng thái hành động đặc biệt (Wave / Jump / Spin)
    _updateSpecialActions(t);

    // 4. Cơ chế chớp mắt tự nhiên (Blink)
    if (!_isBlinking && t > _nextBlinkTime) {
      _isBlinking = true;
      _blinkStartTime = t;
    }

    if (_isBlinking) {
      const blinkDuration = 0.18; // 180ms
      final progress = (t - _blinkStartTime) / blinkDuration;
      if (progress >= 1.0) {
        _isBlinking = false;
        eyeScaleY = 1.0;
        _nextBlinkTime = t + 2.5 + _random.nextDouble() * 2.5;
      } else {
        final scale = (math.cos(progress * math.pi)).abs();
        eyeScaleY = math.max(0.08, scale);
      }
    }

    // 5. Ăng-ten lá đung đưa & viên ngọc xoay 3D
    leafRotZ = -0.5 + math.sin(t * 3.0) * 0.12;
    gemRotY = t * 2.5;

    // Thông báo cho listeners (CustomPaint) mà không rebuild widget tree
    notifyListeners();
  }

  /// Cập nhật logic các hành động: Vẫy tay, Nhảy lên xuống, Xoay vòng
  void _updateSpecialActions(double t) {
    // Tự động kích hoạt hành động định kỳ sau mỗi 5 - 7 giây
    if (currentAction == MascotAction.idle && t >= _nextAutoActionTime) {
      triggerNextAction();
    }

    switch (currentAction) {
      case MascotAction.wave:
        _handleWaveAction(t);
        break;
      case MascotAction.jump:
        _handleJumpAction(t);
        break;
      case MascotAction.spin:
        _handleSpinAction(t);
        break;
      case MascotAction.idle:
        // Đôi tay đập nhịp nhàng mềm mại khi ở trạng thái nghỉ
        leftHandRotX = math.sin(t * 4.5) * 0.35;
        rightHandRotX = math.sin(t * 4.5 + math.pi) * 0.35;
        leftHandRotZ = 0.35 + math.sin(t * 2.8) * 0.12;
        rightHandRotZ = -0.35 - math.sin(t * 2.8) * 0.12;
        rightHandRaiseY = 0.0;
        rightHandWaveAngle = 0.0;
        jumpOffsetY = 0.0;
        spinRotY = 0.0;
        bodySquashScale = 1.0;
        break;
    }
  }

  /// Hành động 1: Vẫy tay chào nhiệt tình
  void _handleWaveAction(double t) {
    const duration = 2.2;
    final progress = (t - _actionStartTime) / duration;

    if (progress >= 1.0) {
      _finishAction();
      return;
    }

    // Nâng tay phải lên cao ngang má/mũ bảo hiểm
    final raiseFactor = math.sin(progress * math.pi).clamp(0.0, 1.0);
    rightHandRaiseY = raiseFactor * 0.45;

    // Tay vẫy qua lại nhanh và vui mắt
    rightHandWaveAngle = math.sin((t - _actionStartTime) * 16.0) * 0.55 * raiseFactor;

    // Tay trái vẫy nhẹ giữ thăng bằng
    leftHandRotZ = 0.45 + math.sin(t * 3.0) * 0.15;

    // Đầu hơi nghiêng nhẹ chào khách
    flightBank = 0.12 * raiseFactor;
  }

  /// Hành động 2: Nhảy lên xuống 2 nhịp vui vẻ (Bouncing Hop)
  void _handleJumpAction(double t) {
    const duration = 1.8;
    final progress = (t - _actionStartTime) / duration;

    if (progress >= 1.0) {
      _finishAction();
      return;
    }

    if (progress < 0.55) {
      // Cú nhảy thứ 1 (cao và mạnh mẽ)
      final p1 = progress / 0.55;
      jumpOffsetY = math.sin(p1 * math.pi) * 0.48;
      bodySquashScale = 1.0 + (math.sin(p1 * math.pi) * 0.12);
    } else {
      // Cú nhảy nảy thứ 2 (nhẹ nhàng đáp đất)
      final p2 = (progress - 0.55) / 0.45;
      jumpOffsetY = math.sin(p2 * math.pi) * 0.26;
      bodySquashScale = 1.0 + (math.sin(p2 * math.pi) * 0.08);
    }

    // Cả 2 tay vẫy nhanh phấn khích khi nhảy
    final flap = math.sin((t - _actionStartTime) * 14.0) * 0.35;
    leftHandRotZ = 0.55 + flap;
    rightHandRotZ = -0.55 - flap;
  }

  /// Hành động 3: Xoay vòng 360 độ trong không gian 3D (Pirouette Spin)
  void _handleSpinAction(double t) {
    const duration = 1.8;
    final progress = (t - _actionStartTime) / duration;

    if (progress >= 1.0) {
      _finishAction();
      return;
    }

    // Góc quay mượt mà từ 0 đến 2π (360 độ)
    // Dùng hàm mượt S-Curve: 3p^2 - 2p^3
    final smoothP = progress * progress * (3.0 - 2.0 * progress);
    spinRotY = smoothP * math.pi * 2.0;

    // Khi xoay, hai tay mở rộng ra hai bên giữ thăng bằng
    leftHandRotZ = 0.65;
    rightHandRotZ = -0.65;
    rightHandRaiseY = 0.1;

    // Nhấc bổng nhẹ lên khi xoay
    jumpOffsetY = math.sin(progress * math.pi) * 0.18;
  }

  void _finishAction() {
    currentAction = MascotAction.idle;
    jumpOffsetY = 0.0;
    spinRotY = 0.0;
    rightHandRaiseY = 0.0;
    rightHandWaveAngle = 0.0;
    bodySquashScale = 1.0;
    _nextAutoActionTime = _elapsedTime + 4.5 + _random.nextDouble() * 3.0;
  }

  /// Kích hoạt hành động tiếp theo trong chu kỳ
  void triggerNextAction() {
    _actionCycleIndex = (_actionCycleIndex + 1) % 3;
    switch (_actionCycleIndex) {
      case 0:
        triggerAction(MascotAction.wave);
        break;
      case 1:
        triggerAction(MascotAction.jump);
        break;
      case 2:
        triggerAction(MascotAction.spin);
        break;
    }
  }

  /// Kích hoạt một hành động cụ thể
  void triggerAction(MascotAction action) {
    currentAction = action;
    _actionStartTime = _elapsedTime;
  }

  /// Kích hoạt hành động vẫy tay
  void triggerWave() => triggerAction(MascotAction.wave);

  /// Kích hoạt hành động nhảy
  void triggerJump() => triggerAction(MascotAction.jump);

  /// Kích hoạt hành động xoay vòng 360 độ
  void triggerSpin() => triggerAction(MascotAction.spin);

  /// Cập nhật vị trí con trỏ tương tác trong khoảng [-1, 1]
  void updatePointer(double normalizedX, double normalizedY) {
    targetRotY = normalizedX * 0.5;
    targetRotX = -normalizedY * 0.3;
  }

  /// Tạm dừng hoặc tiếp tục ticker
  void setPlaying(bool play) {
    if (_isActive == play) return;
    _isActive = play;
    _lastElapsed = null;
  }

  @override
  void dispose() {
    _isDisposed = true;
    _ticker.dispose();
    super.dispose();
  }
}

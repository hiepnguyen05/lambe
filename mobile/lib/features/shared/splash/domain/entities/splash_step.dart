import 'package:flutter/material.dart';

enum SplashStep {
  initializing(
    message: 'Đang kết nối hệ thống LamBe...',
    icon: Icons.cloud_sync_rounded,
    progress: 0.20,
  ),
  checkingAuth(
    message: 'Đang kiểm tra phiên đăng nhập...',
    icon: Icons.lock_person_rounded,
    progress: 0.45,
  ),
  fetchingLocation(
    message: 'Đang định vị không gian quanh bạn...',
    icon: Icons.near_me_rounded,
    progress: 0.75,
  ),
  preparingWorkspace(
    message: 'Đang mở không gian làm việc...',
    icon: Icons.spa_rounded,
    progress: 1.0,
  ),
  completed(
    message: 'Sẵn sàng trải nghiệm!',
    icon: Icons.auto_awesome_rounded,
    progress: 1.0,
  ),
  error(
    message: 'Không thể kết nối đến máy chủ',
    icon: Icons.wifi_off_rounded,
    progress: 1.0,
  );

  final String message;
  final IconData icon;
  final double progress;

  const SplashStep({
    required this.message,
    required this.icon,
    required this.progress,
  });
}

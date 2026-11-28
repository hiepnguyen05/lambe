import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

Future<Position> captureProviderPosition(bool requestPermission) async {
  if (!await Geolocator.isLocationServiceEnabled()) {
    throw StateError('Hãy bật định vị trước khi nhận đơn.');
  }
  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied && requestPermission) {
    permission = await Geolocator.requestPermission();
  }
  if (permission != LocationPermission.always &&
      permission != LocationPermission.whileInUse) {
    throw StateError('Hãy cấp quyền vị trí để nhận đơn.');
  }
  final lastKnown = await Geolocator.getLastKnownPosition(
    forceAndroidLocationManager:
        defaultTargetPlatform == TargetPlatform.android && kDebugMode,
  );
  if (lastKnown != null &&
      lastKnown.accuracy <= 100 &&
      DateTime.now().difference(lastKnown.timestamp).inSeconds <= 25) {
    return lastKnown;
  }
  try {
    return await Geolocator.getCurrentPosition(
      locationSettings: defaultTargetPlatform == TargetPlatform.android
          ? AndroidSettings(
              accuracy: LocationAccuracy.high,
              forceLocationManager: kDebugMode,
              timeLimit: const Duration(seconds: 12),
            )
          : const LocationSettings(
              accuracy: LocationAccuracy.high,
              timeLimit: Duration(seconds: 12),
            ),
    );
  } on TimeoutException {
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 4),
        ),
      );
    } on TimeoutException {
      final fallback = await Geolocator.getLastKnownPosition(
        forceAndroidLocationManager:
            defaultTargetPlatform == TargetPlatform.android && kDebugMode,
      );
      if (fallback != null &&
          fallback.accuracy <= 100 &&
          DateTime.now().difference(fallback.timestamp).inSeconds <= 55) {
        return fallback;
      }
      throw StateError(
        'Không có tọa độ GPS mới. Nếu dùng máy ảo, hãy gửi vị trí trong Location của Emulator rồi thử lại.',
      );
    }
  }
}

Stream<Position> watchProviderPositions(bool high) =>
    Geolocator.getPositionStream(
      locationSettings: defaultTargetPlatform == TargetPlatform.android
          ? AndroidSettings(
              accuracy: high ? LocationAccuracy.high : LocationAccuracy.medium,
              forceLocationManager: kDebugMode,
              distanceFilter: 0,
              intervalDuration: Duration(seconds: high ? 10 : 60),
              foregroundNotificationConfig: const ForegroundNotificationConfig(
                notificationTitle: 'Lambe đang bật nhận đơn',
                notificationText:
                    'Vị trí đang được dùng để nhận đơn và theo dõi hành trình.',
                notificationChannelName: 'Vị trí đối tác Lambe',
                setOngoing: true,
              ),
            )
          : LocationSettings(
              accuracy: high ? LocationAccuracy.high : LocationAccuracy.medium,
              distanceFilter: high ? 0 : 100,
            ),
    );

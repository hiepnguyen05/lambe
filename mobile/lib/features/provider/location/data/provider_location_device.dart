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
  return Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      timeLimit: Duration(seconds: 10),
    ),
  );
}

Stream<Position> watchProviderPositions(bool high) =>
    Geolocator.getPositionStream(
      locationSettings: defaultTargetPlatform == TargetPlatform.android
          ? AndroidSettings(
              accuracy: high ? LocationAccuracy.high : LocationAccuracy.medium,
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

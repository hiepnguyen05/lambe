import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/tracking/domain/order_tracking_snapshot.dart';

void main() {
  test('reads OSRM GeoJSON longitude-latitude pairs into map coordinates', () {
    final snapshot = OrderTrackingSnapshot.fromJson({
      'status': 'LIVE',
      'position': {
        'latitude': 21.0285,
        'longitude': 105.8542,
        'accuracyMeters': 10,
        'capturedAt': DateTime.now().toUtc().toIso8601String(),
      },
      'route': {
        'coordinates': [
          [105.85, 21.02],
          [105.86, 21.03],
        ],
        'distanceMeters': 1500,
        'durationSeconds': 300,
      },
    });

    expect(snapshot.routePoints.first.latitude, 21.02);
    expect(snapshot.routePoints.first.longitude, 105.85);
    expect(snapshot.durationSeconds, 300);
    expect(snapshot.distanceMeters, 1500);
    expect(snapshot.position, isNotNull);
  });

  test('does not invent a position when tracking has not started', () {
    final snapshot = OrderTrackingSnapshot.fromJson({
      'status': 'WAITING_FOR_LOCATION',
      'position': null,
      'route': null,
    });
    expect(snapshot.position, isNull);
    expect(snapshot.routePoints, isEmpty);
    expect(snapshot.distanceMeters, isNull);
  });
}

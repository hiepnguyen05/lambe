import 'package:latlong2/latlong.dart';

class OrderTrackingSnapshot {
  final String status;
  final LatLng? position;
  final DateTime? capturedAt;
  final List<LatLng> routePoints;
  final int? distanceMeters;
  final int? durationSeconds;

  const OrderTrackingSnapshot({
    required this.status,
    required this.position,
    required this.capturedAt,
    required this.routePoints,
    required this.distanceMeters,
    required this.durationSeconds,
  });

  bool get hasFreshPosition =>
      position != null &&
      capturedAt != null &&
      DateTime.now().difference(capturedAt!).inSeconds < 20;

  factory OrderTrackingSnapshot.fromJson(Map<String, dynamic> json) {
    final rawPosition = json['position'];
    final positionData = rawPosition is Map<String, dynamic>
        ? rawPosition
        : null;
    final latitude = (positionData?['latitude'] as num?)?.toDouble();
    final longitude = (positionData?['longitude'] as num?)?.toDouble();
    final rawRoute = json['route'];
    final routeData = rawRoute is Map<String, dynamic> ? rawRoute : null;
    final coordinates = routeData?['coordinates'];
    final points = coordinates is List
        ? coordinates
              .whereType<List>()
              .where(
                (pair) => pair.length == 2 && pair[0] is num && pair[1] is num,
              )
              .map(
                (pair) => LatLng(
                  (pair[1] as num).toDouble(),
                  (pair[0] as num).toDouble(),
                ),
              )
              .toList()
        : <LatLng>[];
    return OrderTrackingSnapshot(
      status: json['status']?.toString() ?? 'WAITING_FOR_LOCATION',
      position: latitude == null || longitude == null
          ? null
          : LatLng(latitude, longitude),
      capturedAt: DateTime.tryParse(
        positionData?['capturedAt']?.toString() ?? '',
      ),
      routePoints: points,
      distanceMeters: (routeData?['distanceMeters'] as num?)?.round(),
      durationSeconds: (routeData?['durationSeconds'] as num?)?.round(),
    );
  }
}

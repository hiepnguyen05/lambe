import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile/core/widgets/app_mini_map.dart';
import 'package:url_launcher/url_launcher.dart';

class ProviderOrderTrackingMap extends StatelessWidget {
  final MapController mapController;
  final LatLng customerLatLng;
  final LatLng? providerLatLng;
  final List<LatLng> routePoints;
  final int? durationSeconds;
  final int? distanceMeters;
  final String destinationLabel;
  final double height;

  const ProviderOrderTrackingMap({
    super.key,
    required this.mapController,
    required this.customerLatLng,
    this.providerLatLng,
    this.routePoints = const [],
    this.durationSeconds,
    this.distanceMeters,
    this.destinationLabel = 'Điểm hẹn',
    this.height = 320,
  });

  Future<void> _openExternalNavigation() async {
    final uri = Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'destination': '${customerLatLng.latitude},${customerLatLng.longitude}',
      'travelmode': 'driving',
      'dir_action': 'navigate',
    });
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: height,
      child: AppMiniMap(
        mapController: mapController,
        mode: AppMiniMapMode.providerNavigation,
        initialCenter: customerLatLng,
        destination: customerLatLng,
        currentPosition: providerLatLng,
        routePoints: routePoints,
        durationSeconds: durationSeconds,
        distanceMeters: distanceMeters,
        destinationLabel: destinationLabel,
        positionLabel: 'Bạn ở đây',
        onNavigate: _openExternalNavigation,
      ),
    );
  }
}

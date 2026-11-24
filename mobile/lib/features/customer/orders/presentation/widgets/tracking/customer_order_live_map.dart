import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile/core/widgets/app_mini_map.dart';

import '../../../domain/entities/customer_order_entity.dart';

class CustomerOrderLiveMap extends StatelessWidget {
  final MapController mapController;
  final CustomerOrderEntity order;
  final LatLng customerLatLng;
  final LatLng? providerLatLng;
  final List<LatLng> routePoints;
  final int? durationSeconds;
  final int? distanceMeters;
  final bool showControls;

  const CustomerOrderLiveMap({
    super.key,
    required this.mapController,
    required this.order,
    required this.customerLatLng,
    this.providerLatLng,
    this.routePoints = const [],
    this.durationSeconds,
    this.distanceMeters,
    this.showControls = true,
  });

  @override
  Widget build(BuildContext context) {
    return AppMiniMap(
      mapController: mapController,
      mode: AppMiniMapMode.customerTracking,
      initialCenter: customerLatLng,
      destination: customerLatLng,
      currentPosition: providerLatLng,
      routePoints: routePoints,
      durationSeconds: durationSeconds,
      distanceMeters: distanceMeters,
      positionLabel: order.isEnRoute
          ? 'Đang tới'
          : order.isArrived
          ? 'Đã đến'
          : 'Thợ',
      showControls: showControls,
    );
  }
}

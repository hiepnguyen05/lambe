import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile/core/widgets/app_mini_map.dart';

class AddressMapPicker extends StatelessWidget {
  final double? latitude;
  final double? longitude;
  final MapController mapController;
  final ValueChanged<LatLng> onMapTap;

  const AddressMapPicker({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.mapController,
    required this.onMapTap,
  });

  @override
  Widget build(BuildContext context) {
    final selected = latitude == null || longitude == null
        ? null
        : LatLng(latitude!, longitude!);

    return SizedBox(
      height: 200,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: AppMiniMap(
          mapController: mapController,
          mode: AppMiniMapMode.addressPicker,
          initialCenter: selected ?? const LatLng(21.028511, 105.804817),
          destination: selected,
          destinationLabel: 'Địa chỉ đã chọn',
          onSelectLocation: onMapTap,
        ),
      ),
    );
  }
}

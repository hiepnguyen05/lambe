import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

class AddressMapPicker extends StatelessWidget {
  final double latitude;
  final double longitude;
  final MapController mapController;
  final Function(LatLng) onMapTap;

  const AddressMapPicker({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.mapController,
    required this.onMapTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F766E).withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: Colors.white, width: 4),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          children: [
            FlutterMap(
              mapController: mapController,
              options: MapOptions(
                initialCenter: LatLng(latitude, longitude),
                initialZoom: 16.0,
                onTap: (tapPosition, point) => onMapTap(point),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.lambe.mobile',
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: LatLng(latitude, longitude),
                      width: 60,
                      height: 60,
                      child: const Icon(
                        Icons.location_on,
                        color: Color(0xFFE11D48),
                        size: 50,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            Positioned(
              bottom: 12,
              right: 12,
              child: FloatingActionButton.small(
                heroTag: 'recenter_map',
                backgroundColor: Colors.white,
                child: const Icon(
                  Icons.center_focus_strong,
                  color: Color(0xFF0F766E),
                ),
                onPressed: () {
                  mapController.move(LatLng(latitude, longitude), 16.0);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

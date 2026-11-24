import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import './address_map_picker.dart';

class AddressLocationPickerSection extends StatelessWidget {
  final bool isLocating;
  final VoidCallback onGetCurrentLocation;
  final double? latitude;
  final double? longitude;
  final MapController mapController;
  final void Function(LatLng) onMapTap;
  final bool isDefault;
  final ValueChanged<bool> onDefaultChanged;

  const AddressLocationPickerSection({
    super.key,
    required this.isLocating,
    required this.onGetCurrentLocation,
    required this.latitude,
    required this.longitude,
    required this.mapController,
    required this.onMapTap,
    required this.isDefault,
    required this.onDefaultChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Nút Định vị
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: isLocating ? null : onGetCurrentLocation,
            icon: isLocating
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.my_location, size: 20),
            label: const Text(
              'Lấy vị trí hiện tại',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F766E),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              elevation: 2,
              shadowColor: const Color(0xFF0F766E).withValues(alpha: 0.4),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ),

        const SizedBox(height: 24),
        const Text(
          'Vị trí trên bản đồ',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 16,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 16),
        AddressMapPicker(
          latitude: latitude,
          longitude: longitude,
          mapController: mapController,
          onMapTap: onMapTap,
        ),

        const SizedBox(height: 24),
        Material(
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFBDC9C6)),
          ),
          child: SwitchListTile(
            title: const Text(
              'Đặt làm địa chỉ mặc định',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Color(0xFF0B1C30),
              ),
            ),
            value: isDefault,
            activeThumbColor: const Color(0xFF0F766E),
            activeTrackColor: const Color(0xFF0F766E).withValues(alpha: 0.3),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            onChanged: onDefaultChanged,
          ),
        ),
      ],
    );
  }
}

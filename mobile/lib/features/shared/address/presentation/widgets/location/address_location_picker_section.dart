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
          child: FilledButton.icon(
            onPressed: isLocating ? null : onGetCurrentLocation,
            icon: isLocating
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFF0F766E),
                    ),
                  )
                : const Icon(Icons.my_location_rounded, size: 18),
            label: const Text(
              'Lấy vị trí hiện tại',
              style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFF0FDFA),
              foregroundColor: const Color(0xFF0F766E),
              padding: const EdgeInsets.symmetric(vertical: 13),
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xFF99F6E4)),
              ),
            ),
          ),
        ),

        const SizedBox(height: 16),
        const Text(
          'Vị trí trên bản đồ',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 15,
            color: Color(0xFF0B1C30),
          ),
        ),
        const SizedBox(height: 10),
        AddressMapPicker(
          latitude: latitude,
          longitude: longitude,
          mapController: mapController,
          onMapTap: onMapTap,
        ),

        const SizedBox(height: 14),
        Material(
          color: const Color(0xFFF8FAFC),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
          child: SwitchListTile(
            title: const Text(
              'Đặt làm địa chỉ mặc định',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0B1C30),
              ),
            ),
            value: isDefault,
            activeThumbColor: const Color(0xFF0F766E),
            activeTrackColor: const Color(0xFF0F766E).withValues(alpha: 0.3),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            onChanged: onDefaultChanged,
          ),
        ),
      ],
    );
  }
}

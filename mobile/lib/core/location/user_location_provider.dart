import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

class UserLocationModel {
  final double latitude;
  final double longitude;
  final String addressLine;
  final String? district;
  final String? city;
  final bool isLoaded;
  final bool hasPermission;
  final bool serviceEnabled;
  final String? error;

  const UserLocationModel({
    this.latitude = 10.7731,
    this.longitude = 106.703,
    this.addressLine = '',
    this.district,
    this.city,
    this.isLoaded = false,
    this.hasPermission = false,
    this.serviceEnabled = false,
    this.error,
  });

  UserLocationModel copyWith({
    double? latitude,
    double? longitude,
    String? addressLine,
    String? district,
    String? city,
    bool? isLoaded,
    bool? hasPermission,
    bool? serviceEnabled,
    String? error,
  }) {
    return UserLocationModel(
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      addressLine: addressLine ?? this.addressLine,
      district: district ?? this.district,
      city: city ?? this.city,
      isLoaded: isLoaded ?? this.isLoaded,
      hasPermission: hasPermission ?? this.hasPermission,
      serviceEnabled: serviceEnabled ?? this.serviceEnabled,
      error: error,
    );
  }

  @override
  String toString() =>
      'UserLocationModel(lat: $latitude, lng: $longitude, address: $addressLine, isLoaded: $isLoaded)';
}

class UserLocationNotifier extends StateNotifier<UserLocationModel> {
  UserLocationNotifier() : super(const UserLocationModel());

  StreamSubscription<Position>? _positionStreamSub;

  @override
  void dispose() {
    _positionStreamSub?.cancel();
    super.dispose();
  }

  /// Lấy vị trí GPS hiện tại của người dùng kèm địa chỉ phường/quận/thành phố
  Future<UserLocationModel> fetchLocation({
    Duration timeout = const Duration(seconds: 8),
  }) async {
    try {
      debugPrint('📍 [UserLocation] Kiểm tra dịch vụ định vị GPS...');
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('⚠️ [UserLocation] Dịch vụ định vị đang tắt trên thiết bị.');
        state = state.copyWith(
          serviceEnabled: false,
          isLoaded: true,
          addressLine: 'Chưa bật định vị GPS',
          error: 'Dịch vụ định vị chưa bật',
        );
        return state;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        debugPrint('📍 [UserLocation] Yêu cầu cấp quyền định vị...');
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        debugPrint('⚠️ [UserLocation] Quyền định vị bị từ chối ($permission).');
        state = state.copyWith(
          hasPermission: false,
          serviceEnabled: serviceEnabled,
          isLoaded: true,
          addressLine: 'Chưa cấp quyền vị trí',
          error: 'Chưa cấp quyền truy cập vị trí',
        );
        return state;
      }

      // Quan trọng: Sử dụng AndroidSettings với forceLocationManager = true
      // Để nhận ngay lập tức mock location được đẩy từ Android Emulator
      final LocationSettings locationSettings;
      if (defaultTargetPlatform == TargetPlatform.android) {
        locationSettings = AndroidSettings(
          accuracy: LocationAccuracy.high,
          forceLocationManager: true, // Ép dùng LocationManager để bắt mock GPS máy ảo
          intervalDuration: const Duration(seconds: 1),
          timeLimit: timeout,
        );
      } else {
        locationSettings = AppleSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: timeout,
        );
      }

      Position? position;
      try {
        debugPrint('📍 [UserLocation] Đang lấy tọa độ GPS thực tế từ LocationManager...');
        position = await Geolocator.getCurrentPosition(
          locationSettings: locationSettings,
        );
        debugPrint('📍 [UserLocation] Tọa độ GPS tươi mới: ${position.latitude}, ${position.longitude}');
      } catch (gpsError) {
        debugPrint('⚠️ [UserLocation] getCurrentPosition lỗi ($gpsError), kiểm tra vị trí gần nhất...');
        try {
          position = await Geolocator.getLastKnownPosition();
        } catch (_) {}
      }

      if (position == null) {
        debugPrint('⚠️ [UserLocation] Không thể lấy được tọa độ GPS.');
        state = state.copyWith(
          isLoaded: true,
          hasPermission: true,
          serviceEnabled: true,
          addressLine: state.addressLine.isNotEmpty ? state.addressLine : 'Không thể lấy tọa độ GPS',
          error: 'Không thể lấy tọa độ hiện tại',
        );
        return state;
      }

      await _applyPosition(position);

      // Kích hoạt lắng nghe luồng GPS tự động khi đổi vị trí máy ảo
      _startPositionStream();

      return state;
    } catch (e) {
      debugPrint('❌ [UserLocation] Lỗi khi xử lý vị trí: $e');
      state = state.copyWith(
        isLoaded: true,
        addressLine: state.addressLine.isNotEmpty ? state.addressLine : 'Không thể xác định vị trí',
        error: e.toString(),
      );
      return state;
    }
  }

  void _startPositionStream() {
    _positionStreamSub?.cancel();
    try {
      final LocationSettings streamSettings;
      if (defaultTargetPlatform == TargetPlatform.android) {
        streamSettings = AndroidSettings(
          accuracy: LocationAccuracy.high,
          forceLocationManager: true,
          distanceFilter: 10,
          intervalDuration: const Duration(seconds: 2),
        );
      } else {
        streamSettings = AppleSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
        );
      }

      _positionStreamSub = Geolocator.getPositionStream(
        locationSettings: streamSettings,
      ).listen((Position newPos) {
        // Chỉ cập nhật nếu tọa độ thực sự thay đổi đáng kể (>0.0001)
        if ((newPos.latitude - state.latitude).abs() > 0.0001 ||
            (newPos.longitude - state.longitude).abs() > 0.0001) {
          debugPrint('📡 [UserLocation] GPS máy ảo/thiết bị thay đổi: ${newPos.latitude}, ${newPos.longitude}');
          _applyPosition(newPos);
        }
      }, onError: (err) {
        debugPrint('⚠️ [UserLocation] Lỗi stream vị trí: $err');
      });
    } catch (e) {
      debugPrint('⚠️ [UserLocation] Không thể khởi chạy stream vị trí: $e');
    }
  }

  Future<void> _applyPosition(Position position) async {
    String address = '';
    String? district;
    String? city;

    try {
      final placemarks = await Geocoding().placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );

      if (placemarks.isNotEmpty) {
        final place = placemarks.first;
        final rawParts = <String>[];

        final street = place.street ?? place.thoroughfare;
        final name = place.name;
        final subLocality = place.subLocality;
        final subAdmin = place.subAdministrativeArea;
        final locality = place.locality;
        final admin = place.administrativeArea;

        if (street != null && street.trim().isNotEmpty) {
          rawParts.add(street.trim());
        } else if (name != null && name.trim().isNotEmpty) {
          rawParts.add(name.trim());
        }

        if (subLocality != null && subLocality.trim().isNotEmpty) {
          rawParts.add(subLocality.trim());
        }
        if (subAdmin != null && subAdmin.trim().isNotEmpty) {
          district = subAdmin.trim();
          rawParts.add(district);
        }
        if (locality != null && locality.trim().isNotEmpty) {
          rawParts.add(locality.trim());
        }
        if (admin != null && admin.trim().isNotEmpty) {
          city = admin.trim();
          rawParts.add(city);
        }

        // Khử trùng lặp chuỗi địa chỉ
        final cleanParts = <String>[];
        for (final part in rawParts) {
          final lower = part.toLowerCase();
          final exists = cleanParts.any(
            (p) => p.toLowerCase() == lower || p.toLowerCase().contains(lower) || lower.contains(p.toLowerCase()),
          );
          if (!exists) {
            cleanParts.add(part);
          }
        }

        if (cleanParts.isNotEmpty) {
          address = cleanParts.join(', ');
        }
      }
    } catch (geoError) {
      debugPrint('⚠️ [UserLocation] Không thể reverse geocode tọa độ: $geoError');
    }

    if (address.isEmpty) {
      address = '${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}';
    }

    state = UserLocationModel(
      latitude: position.latitude,
      longitude: position.longitude,
      addressLine: address,
      district: district,
      city: city,
      isLoaded: true,
      hasPermission: true,
      serviceEnabled: true,
    );

    debugPrint('✅ [UserLocation] Vị trí mới được áp dụng: $address (${position.latitude}, ${position.longitude})');
  }
}

final userLocationProvider =
    StateNotifierProvider<UserLocationNotifier, UserLocationModel>((ref) {
  return UserLocationNotifier();
});

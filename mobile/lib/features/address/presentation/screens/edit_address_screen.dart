import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../core/utils/app_dialogs.dart';
import '../../../auth/di/auth_providers.dart';
import '../../domain/entities/address_entity.dart';
import '../../di/address_providers.dart';
import '../widgets/address_map_picker.dart';
import '../widgets/contact_info_section.dart';
import '../widgets/address_details_section.dart';
import '../widgets/address_type_section.dart';

class EditAddressScreen extends ConsumerStatefulWidget {
  final AddressEntity? address;

  const EditAddressScreen({super.key, this.address});

  @override
  ConsumerState<EditAddressScreen> createState() => _EditAddressScreenState();
}

class _EditAddressScreenState extends ConsumerState<EditAddressScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _provinceController;
  late TextEditingController _districtController;
  late TextEditingController _wardController;
  late TextEditingController _streetController;

  late TextEditingController _contactNameController;
  late TextEditingController _contactPhoneController;
  late TextEditingController _noteController;

  String _selectedType = 'HOME';
  bool _isDefault = false;
  bool _isLoading = false;
  bool _isLocating = false;

  double? _latitude;
  double? _longitude;

  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    _provinceController = TextEditingController(
      text: widget.address?.provinceName ?? '',
    );
    _districtController = TextEditingController(
      text: widget.address?.districtName ?? '',
    );
    _wardController = TextEditingController(
      text: widget.address?.wardName ?? '',
    );
    _streetController = TextEditingController(
      text: widget.address?.streetLine ?? widget.address?.addressLine ?? '',
    );

    _contactNameController = TextEditingController(
      text: widget.address?.contactName ?? '',
    );
    _contactPhoneController = TextEditingController(
      text: widget.address?.contactPhone ?? '',
    );
    _noteController = TextEditingController(text: widget.address?.note ?? '');

    // Tự động điền thông tin người dùng nếu tạo mới địa chỉ
    if (widget.address == null) {
      final userState = ref.read(authNotifierProvider);
      if (userState.value != null) {
        final user = userState.value!;
        if (_contactNameController.text.isEmpty) {
          _contactNameController.text = user.fullName ?? '';
        }
        if (_contactPhoneController.text.isEmpty) {
          _contactPhoneController.text = user.phone ?? '';
        }
      }
    }

    _selectedType = widget.address?.type ?? 'HOME';
    _isDefault = widget.address?.isDefault ?? false;

    _latitude = widget.address?.latitude;
    _longitude = widget.address?.longitude;
  }

  @override
  void dispose() {
    _provinceController.dispose();
    _districtController.dispose();
    _wardController.dispose();
    _streetController.dispose();
    _contactNameController.dispose();
    _contactPhoneController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _getCurrentLocation() async {
    setState(() => _isLocating = true);
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception('Dịch vụ vị trí đang bị tắt. Vui lòng bật vị trí.');
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          throw Exception('Quyền truy cập vị trí bị từ chối.');
        }
      }
      if (permission == LocationPermission.deniedForever) {
        throw Exception('Quyền truy cập vị trí bị từ chối vĩnh viễn.');
      }

      Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );

      setState(() {
        _latitude = position.latitude;
        _longitude = position.longitude;
      });

      _mapController.move(LatLng(position.latitude, position.longitude), 16.0);

      await _updateAddressFromCoordinates(
        position.latitude,
        position.longitude,
      );
    } catch (e) {
      if (mounted) {
        AppDialogs.showErrorDialog(
          context,
          message: 'Không thể lấy vị trí: ${e.toString()}',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLocating = false);
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final parts = [
      _streetController.text.trim(),
      _wardController.text.trim(),
      _provinceController.text.trim(),
    ].where((e) => e.isNotEmpty).toList();

    final fullAddressLine = parts.join(', ');

    String finalDistrict = _districtController.text.trim();
    String finalWard = _wardController.text.trim();

    if (finalDistrict.isEmpty && finalWard.isNotEmpty) {
      if (finalWard.contains(',')) {
        final wardParts = finalWard.split(',');
        finalDistrict = wardParts.last.trim();
        finalWard = wardParts.sublist(0, wardParts.length - 1).join(',').trim();
      } else {
        finalDistrict = finalWard;
      }
    }
    if (finalDistrict.isEmpty || finalDistrict.length < 2) {
      finalDistrict = "Chưa xác định";
    }

    final newAddress = AddressEntity(
      id: widget.address?.id ?? '',
      type: _selectedType,
      label: _selectedType == 'HOME'
          ? 'Nhà'
          : (_selectedType == 'WORK' ? 'Công ty' : 'Khác'),
      addressLine: fullAddressLine,
      provinceName: _provinceController.text.trim(),
      districtName: finalDistrict,
      wardName: finalWard,
      streetLine: _streetController.text.trim(),
      latitude: _latitude,
      longitude: _longitude,
      isMapConfirmed: _latitude != null && _longitude != null,
      contactName: _contactNameController.text.trim(),
      contactPhone: _contactPhoneController.text.trim(),
      note: _noteController.text.trim(),
      isDefault: _isDefault,
    );

    try {
      if (widget.address == null) {
        await ref
            .read(addressNotifierProvider.notifier)
            .createAddress(newAddress);
      } else {
        await ref
            .read(addressNotifierProvider.notifier)
            .updateAddress(widget.address!.id, newAddress);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Lưu địa chỉ thành công!',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            backgroundColor: Color(0xFF0F766E),
            behavior: SnackBarBehavior.floating,
            duration: Duration(seconds: 2),
          ),
        );
        context.pop(); // Trở về màn hình trước (danh sách địa chỉ)
      }
    } catch (e) {
      if (mounted) {
        AppDialogs.showErrorDialog(context, message: e.toString());
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _updateAddressFromCoordinates(double lat, double lng) async {
    try {
      List<Placemark> placemarks = await Geocoding().placemarkFromCoordinates(
        lat,
        lng,
      );
      if (placemarks.isNotEmpty) {
        Placemark place = placemarks.first;
        String province = place.administrativeArea ?? '';
        if (province.contains('Thành phố ')) {
          province = province.replaceAll('Thành phố ', '');
        }
        if (province.contains('Tỉnh ')) {
          province = province.replaceAll('Tỉnh ', '');
        }

        String district = place.subAdministrativeArea ?? place.locality ?? '';
        String ward = place.subLocality ?? '';
        String street = place.street ?? place.name ?? '';

        if (street.contains(ward) && ward.isNotEmpty) {
          street = street.replaceAll(', $ward', '').replaceAll(ward, '').trim();
        }
        String mergedWardDistrict = [
          ward,
          district,
        ].where((e) => e.isNotEmpty).join(', ');

        setState(() {
          _provinceController.text = province;
          _districtController.text = '';
          _wardController.text = mergedWardDistrict;
          _streetController.text = street;
        });
      }
    } catch (_) {}
  }

  Future<void> _geocodeManualAddress() async {
    final fullAddress = [
      _streetController.text.trim(),
      _wardController.text.trim(),
      _provinceController.text.trim(),
    ].where((e) => e.isNotEmpty).join(', ');

    if (fullAddress.isEmpty) return;

    setState(() => _isLocating = true);
    try {
      List<Location> locations = await Geocoding().locationFromAddress(
        fullAddress,
      );
      if (locations.isNotEmpty) {
        final loc = locations.first;
        setState(() {
          _latitude = loc.latitude;
          _longitude = loc.longitude;
        });
        _mapController.move(LatLng(loc.latitude, loc.longitude), 16.0);
      }
    } catch (e) {
      // Ignored if address not found
    } finally {
      if (mounted) setState(() => _isLocating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        title: Text(
          widget.address == null ? 'Thêm địa chỉ mới' : 'Cập nhật địa chỉ',
          style: const TextStyle(
            color: Color(0xFF0B1C30),
            fontWeight: FontWeight.bold,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF0B1C30)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ContactInfoSection(
                nameController: _contactNameController,
                phoneController: _contactPhoneController,
                noteController: _noteController,
              ),
              const SizedBox(height: 32),

              AddressTypeSection(
                selectedType: _selectedType,
                onTypeSelected: (type) => setState(() => _selectedType = type),
              ),
              const SizedBox(height: 32),

              AddressDetailsSection(
                provinceController: _provinceController,
                wardController: _wardController,
                streetController: _streetController,
                onAddressSubmitted: _geocodeManualAddress,
              ),
              const SizedBox(height: 24),

              // 4. Định vị và Bản đồ
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _isLocating ? null : _getCurrentLocation,
                  icon: _isLocating
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
                latitude: _latitude ?? 21.028511, // Mặc định Hà Nội
                longitude: _longitude ?? 105.804817,
                mapController: _mapController,
                onMapTap: (point) async {
                  setState(() {
                    _latitude = point.latitude;
                    _longitude = point.longitude;
                  });
                  await _updateAddressFromCoordinates(
                    point.latitude,
                    point.longitude,
                  );
                },
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
                  value: _isDefault,
                  activeThumbColor: const Color(0xFF0F766E),
                  activeTrackColor: const Color(0xFF0F766E)
                      .withValues(alpha: 0.3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  onChanged: (val) {
                    setState(() {
                      _isDefault = val;
                    });
                  },
                ),
              ),
              const SizedBox(height: 24), // Extra space for bottom nav
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 10,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: ElevatedButton(
            onPressed: _isLoading ? null : _save,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0F766E),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              elevation: 4,
              shadowColor: const Color(0xFF0F766E).withValues(alpha: 0.3),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(100),
              ),
            ),
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : const Text(
                    'Lưu địa chỉ',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
          ),
        ),
      ),
    );
  }
}

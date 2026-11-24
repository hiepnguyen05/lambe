import 'package:equatable/equatable.dart';

class InlineOrderAddress extends Equatable {
  final String label;
  final String addressLine;
  final double latitude;
  final double longitude;
  final String? provinceName;
  final String? districtName;
  final String? wardName;
  final String? streetLine;
  final String? note;

  const InlineOrderAddress({
    required this.label,
    required this.addressLine,
    required this.latitude,
    required this.longitude,
    this.provinceName,
    this.districtName,
    this.wardName,
    this.streetLine,
    this.note,
  });

  Map<String, dynamic> toJson() {
    return {
      'label': label,
      'addressLine': addressLine,
      'latitude': latitude,
      'longitude': longitude,
      if (provinceName != null && provinceName!.isNotEmpty)
        'provinceName': provinceName,
      if (districtName != null && districtName!.isNotEmpty)
        'districtName': districtName,
      if (wardName != null && wardName!.isNotEmpty) 'wardName': wardName,
      if (streetLine != null && streetLine!.isNotEmpty)
        'streetLine': streetLine,
      if (note != null && note!.isNotEmpty) 'note': note,
    };
  }

  factory InlineOrderAddress.fromJson(Map<String, dynamic> json) {
    return InlineOrderAddress(
      label: json['label']?.toString() ?? 'Địa chỉ thực hiện',
      addressLine: json['addressLine']?.toString() ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      provinceName: json['provinceName']?.toString(),
      districtName: json['districtName']?.toString(),
      wardName: json['wardName']?.toString(),
      streetLine: json['streetLine']?.toString(),
      note: json['note']?.toString(),
    );
  }

  @override
  List<Object?> get props => [
    label,
    addressLine,
    latitude,
    longitude,
    provinceName,
    districtName,
    wardName,
    streetLine,
    note,
  ];
}

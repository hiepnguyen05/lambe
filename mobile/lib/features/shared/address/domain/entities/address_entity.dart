class AddressEntity {
  final String id;
  final String? type; // HOME, WORK, OTHER
  final String? label;
  final String addressLine;
  final String? provinceName;
  final String? districtName;
  final String? wardName;
  final String? streetLine;
  final double? latitude;
  final double? longitude;
  final bool? isMapConfirmed;
  final String? contactName;
  final String? contactPhone;
  final String? note;
  final bool isDefault;

  const AddressEntity({
    required this.id,
    this.type,
    this.label,
    required this.addressLine,
    this.provinceName,
    this.districtName,
    this.wardName,
    this.streetLine,
    this.latitude,
    this.longitude,
    this.isMapConfirmed,
    this.contactName,
    this.contactPhone,
    this.note,
    this.isDefault = false,
  });

  AddressEntity copyWith({bool? isDefault}) {
    return AddressEntity(
      id: id,
      type: type,
      label: label,
      addressLine: addressLine,
      provinceName: provinceName,
      districtName: districtName,
      wardName: wardName,
      streetLine: streetLine,
      latitude: latitude,
      longitude: longitude,
      isMapConfirmed: isMapConfirmed,
      contactName: contactName,
      contactPhone: contactPhone,
      note: note,
      isDefault: isDefault ?? this.isDefault,
    );
  }

  factory AddressEntity.fromJson(Map<String, dynamic> json) {
    return AddressEntity(
      id: json['id'] as String? ?? '',
      type: json['type'] as String?,
      label: json['label'] as String?,
      addressLine: json['addressLine'] as String? ?? '',
      provinceName: json['provinceName'] as String?,
      districtName: json['districtName'] as String?,
      wardName: json['wardName'] as String?,
      streetLine: json['streetLine'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      isMapConfirmed: json['isMapConfirmed'] as bool?,
      contactName: json['contactName'] as String?,
      contactPhone: json['contactPhone'] as String?,
      note: json['note'] as String?,
      isDefault: json['isDefault'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'label': label,
      'addressLine': addressLine,
      'provinceName': provinceName,
      'districtName': districtName,
      'wardName': wardName,
      'streetLine': streetLine,
      'latitude': latitude,
      'longitude': longitude,
      'isMapConfirmed': isMapConfirmed ?? false,
      'contactName': contactName,
      'contactPhone': contactPhone,
      'note': note,
      'isDefault': isDefault,
    };
  }
}

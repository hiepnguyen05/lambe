import '../../domain/entities/address_entity.dart';

class AddressModel {
  const AddressModel._();

  static AddressEntity fromJson(Map<String, dynamic> json) {
    return AddressEntity(
      id: json['id'] as String,
      type: json['type'] as String?,
      label: json['label'] as String?,
      addressLine: json['addressLine'] as String,
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

  static Map<String, dynamic> toJson(AddressEntity entity) {
    return {
      'type': entity.type,
      'label': entity.label,
      'addressLine': entity.addressLine,
      'provinceName': entity.provinceName,
      'districtName': entity.districtName,
      'wardName': entity.wardName,
      'streetLine': entity.streetLine,
      'latitude': entity.latitude,
      'longitude': entity.longitude,
      'isMapConfirmed': entity.isMapConfirmed ?? false,
      'contactName': entity.contactName,
      'contactPhone': entity.contactPhone,
      'note': entity.note,
      'isDefault': entity.isDefault,
    };
  }
}

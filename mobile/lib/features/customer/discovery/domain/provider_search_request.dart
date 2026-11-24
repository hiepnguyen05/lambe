import 'package:equatable/equatable.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/features/customer/booking/domain/entities/booking_draft_entity.dart';

class ProviderSearchRequest extends Equatable {
  final String serviceId;
  final BookingType bookingType;
  final DateTime? scheduledAt;
  final String? customerAddressId;
  final double? latitude;
  final double? longitude;
  final int radiusKm;
  final int limit;

  const ProviderSearchRequest({
    required this.serviceId,
    this.bookingType = BookingType.asap,
    this.scheduledAt,
    this.customerAddressId,
    this.latitude,
    this.longitude,
    this.radiusKm = 30,
    this.limit = 20,
  });

  Map<String, dynamic> toJson() {
    if (serviceId.trim().isEmpty) {
      throw const ValidationFailure(
        'Vui lòng chọn dịch vụ cần tìm chuyên viên.',
      );
    }
    if (bookingType == BookingType.scheduled && scheduledAt == null) {
      throw const ValidationFailure('Vui lòng chọn ngày giờ đặt trước.');
    }
    final saved = customerAddressId?.trim();
    if (saved == null || saved.isEmpty) {
      if (latitude == null ||
          longitude == null ||
          !latitude!.isFinite ||
          !longitude!.isFinite ||
          latitude! < -90 ||
          latitude! > 90 ||
          longitude! < -180 ||
          longitude! > 180) {
        throw const ValidationFailure(
          'Vui lòng chọn địa chỉ hoặc lấy vị trí hiện tại.',
        );
      }
    }
    if (radiusKm < 1 || radiusKm > 50 || limit < 1 || limit > 50) {
      throw const ValidationFailure('Phạm vi tìm kiếm không hợp lệ.');
    }
    return {
      'serviceId': serviceId,
      'bookingType': bookingType.toApiValue(),
      if (bookingType == BookingType.scheduled)
        'scheduledAt': scheduledAt!.toUtc().toIso8601String(),
      if (saved != null && saved.isNotEmpty)
        'customerAddressId': saved
      else ...{
        'latitude': latitude,
        'longitude': longitude,
      },
      'radiusKm': radiusKm,
      'limit': limit,
    };
  }

  @override
  List<Object?> get props => [
    serviceId,
    bookingType,
    scheduledAt,
    customerAddressId,
    latitude,
    longitude,
    radiusKm,
    limit,
  ];
}

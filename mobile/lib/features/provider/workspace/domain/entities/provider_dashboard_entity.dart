import 'package:mobile/core/utils/address_utils.dart';

class ProviderDashboardEntity {
  final bool isOnline;
  final bool availabilityVerified, isUpdating;
  final int serviceRadius;
  final double todayEarnings;
  final int completedBookings;
  final List<ProviderAppointmentEntity> upcomingAppointments;

  const ProviderDashboardEntity({
    this.isOnline = false,
    this.availabilityVerified = false,
    this.isUpdating = false,
    this.serviceRadius = 5,
    this.todayEarnings = 0.0,
    this.completedBookings = 0,
    this.upcomingAppointments = const [],
  });

  ProviderDashboardEntity copyWith({
    bool? isOnline,
    bool? availabilityVerified,
    bool? isUpdating,
    int? serviceRadius,
    double? todayEarnings,
    int? completedBookings,
    List<ProviderAppointmentEntity>? upcomingAppointments,
  }) {
    return ProviderDashboardEntity(
      isOnline: isOnline ?? this.isOnline,
      availabilityVerified: availabilityVerified ?? this.availabilityVerified,
      isUpdating: isUpdating ?? this.isUpdating,
      serviceRadius: serviceRadius ?? this.serviceRadius,
      todayEarnings: todayEarnings ?? this.todayEarnings,
      completedBookings: completedBookings ?? this.completedBookings,
      upcomingAppointments: upcomingAppointments ?? this.upcomingAppointments,
    );
  }
}

class ProviderAppointmentEntity {
  final String id;
  final String? customerId;
  final String customerName;
  final String customerAvatar;
  final double? customerRating;
  final String? contactPhone;
  final String serviceName;
  final String address;
  final DateTime scheduledTime;
  final DateTime? overdueAt;
  final double? travelDistanceKm;
  final double price;

  const ProviderAppointmentEntity({
    required this.id,
    this.customerId,
    required this.customerName,
    required this.customerAvatar,
    required this.customerRating,
    this.contactPhone,
    required this.serviceName,
    required this.address,
    required this.scheduledTime,
    this.overdueAt,
    this.travelDistanceKm,
    required this.price,
  });

  factory ProviderAppointmentEntity.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map? ?? const {};
    final time = DateTime.tryParse(
      (json['expectedStartAt'] ?? json['scheduledAt'])?.toString() ?? '',
    );
    final id = json['id']?.toString() ?? '';
    if (id.isEmpty || time == null) {
      throw const FormatException('Đơn sắp tới thiếu mã đơn hoặc giờ phục vụ.');
    }
    final rawCustomerId = (json['customerId'] ?? customer['id'])
        ?.toString()
        .trim();
    final contactName = json['contactName']?.toString().trim();
    final distance = (json['travelDistanceKm'] as num?)?.toDouble();
    final rawAddressLine = json['addressLine']?.toString().trim() ?? '';
    final rawAddressLabel = json['addressLabel']?.toString().trim() ?? '';
    return ProviderAppointmentEntity(
      id: id,
      customerId: rawCustomerId?.isNotEmpty == true ? rawCustomerId : null,
      customerName: contactName?.isNotEmpty == true
          ? contactName!
          : customer['fullName']?.toString() ?? 'Khách hàng',
      customerAvatar: customer['avatarUrl']?.toString() ?? '',
      customerRating: (json['customerRating'] as num?)?.toDouble(),
      contactPhone: (json['contactPhone'] ?? customer['phone'])?.toString(),
      serviceName: json['serviceName']?.toString() ?? 'Dịch vụ',
      address: AddressUtils.deduplicate(
        rawAddressLine.isNotEmpty ? rawAddressLine : rawAddressLabel,
      ),
      scheduledTime: time.toLocal(),
      overdueAt: DateTime.tryParse(json['scheduleOverdueAt']?.toString() ?? ''),
      travelDistanceKm: distance != null && distance.isFinite && distance >= 0
          ? distance
          : null,
      price: (json['totalAmount'] as num?)?.toDouble() ?? 0,
    );
  }
}

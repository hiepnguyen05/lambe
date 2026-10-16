class ProviderDashboardEntity {
  final bool isOnline;
  final int serviceRadius;
  final double todayEarnings;
  final int completedBookings;
  final List<ProviderAppointmentEntity> upcomingAppointments;

  const ProviderDashboardEntity({
    this.isOnline = false,
    this.serviceRadius = 5,
    this.todayEarnings = 0.0,
    this.completedBookings = 0,
    this.upcomingAppointments = const [],
  });

  ProviderDashboardEntity copyWith({
    bool? isOnline,
    int? serviceRadius,
    double? todayEarnings,
    int? completedBookings,
    List<ProviderAppointmentEntity>? upcomingAppointments,
  }) {
    return ProviderDashboardEntity(
      isOnline: isOnline ?? this.isOnline,
      serviceRadius: serviceRadius ?? this.serviceRadius,
      todayEarnings: todayEarnings ?? this.todayEarnings,
      completedBookings: completedBookings ?? this.completedBookings,
      upcomingAppointments: upcomingAppointments ?? this.upcomingAppointments,
    );
  }
}

class ProviderAppointmentEntity {
  final String id;
  final String customerName;
  final String customerAvatar;
  final double customerRating;
  final String serviceName;
  final String address;
  final DateTime scheduledTime;
  final double price;

  const ProviderAppointmentEntity({
    required this.id,
    required this.customerName,
    required this.customerAvatar,
    required this.customerRating,
    required this.serviceName,
    required this.address,
    required this.scheduledTime,
    required this.price,
  });
}

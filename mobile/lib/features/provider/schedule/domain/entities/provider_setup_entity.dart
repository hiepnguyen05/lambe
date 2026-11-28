import 'package:equatable/equatable.dart';

import './provider_working_hour_entity.dart';

class ProviderSetupEntity extends Equatable {
  final String serviceAreaName;
  final double? serviceAreaLatitude;
  final double? serviceAreaLongitude;
  final int serviceRadiusKm;
  final List<ProviderWorkingHourEntity> workingHours;

  const ProviderSetupEntity({
    this.serviceAreaName = '',
    this.serviceAreaLatitude,
    this.serviceAreaLongitude,
    this.serviceRadiusKm = 10,
    this.workingHours = const [],
  });

  int get daysWorkingCount => workingHours
      .where((h) => h.isWorking)
      .map((h) => h.dayOfWeek)
      .toSet()
      .length;

  double get totalWeeklyHours {
    double total = 0;
    for (final h in workingHours) {
      if (h.isWorking) {
        total += h.workingHoursCount;
      }
    }
    return total;
  }

  factory ProviderSetupEntity.fromJson(Map<String, dynamic> json) {
    final areaName = json['serviceAreaName']?.toString() ?? '';
    final lat = (json['serviceAreaLatitude'] as num?)?.toDouble();
    final lng = (json['serviceAreaLongitude'] as num?)?.toDouble();
    final radius = (json['serviceRadiusKm'] as num?)?.toInt() ?? 10;

    final rawHours = (json['workingHours'] as List<dynamic>?) ?? [];
    final hours = rawHours
        .whereType<Map<String, dynamic>>()
        .map((e) => ProviderWorkingHourEntity.fromJson(e))
        .toList();

    return ProviderSetupEntity(
      serviceAreaName: areaName,
      serviceAreaLatitude: lat,
      serviceAreaLongitude: lng,
      serviceRadiusKm: radius,
      workingHours: hours,
    );
  }

  @override
  List<Object?> get props => [
    serviceAreaName,
    serviceAreaLatitude,
    serviceAreaLongitude,
    serviceRadiusKm,
    workingHours,
  ];
}

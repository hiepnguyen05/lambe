import 'package:equatable/equatable.dart';

import './provider_working_hour_entity.dart';

class ProviderSetupEntity extends Equatable {
  final String serviceAreaName;
  final double serviceAreaLatitude;
  final double serviceAreaLongitude;
  final int serviceRadiusKm;
  final List<ProviderWorkingHourEntity> workingHours;
  final List<String> enabledServiceIds;

  const ProviderSetupEntity({
    this.serviceAreaName = '',
    this.serviceAreaLatitude = 21.0368,
    this.serviceAreaLongitude = 105.7827,
    this.serviceRadiusKm = 10,
    this.workingHours = const [],
    this.enabledServiceIds = const [],
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

  ProviderSetupEntity copyWith({
    String? serviceAreaName,
    double? serviceAreaLatitude,
    double? serviceAreaLongitude,
    int? serviceRadiusKm,
    List<ProviderWorkingHourEntity>? workingHours,
    List<String>? enabledServiceIds,
  }) {
    return ProviderSetupEntity(
      serviceAreaName: serviceAreaName ?? this.serviceAreaName,
      serviceAreaLatitude: serviceAreaLatitude ?? this.serviceAreaLatitude,
      serviceAreaLongitude: serviceAreaLongitude ?? this.serviceAreaLongitude,
      serviceRadiusKm: serviceRadiusKm ?? this.serviceRadiusKm,
      workingHours: workingHours ?? this.workingHours,
      enabledServiceIds: enabledServiceIds ?? this.enabledServiceIds,
    );
  }

  factory ProviderSetupEntity.fromJson(Map<String, dynamic> json) {
    final areaName = json['serviceAreaName']?.toString() ?? 'Hà Nội';
    final lat = (json['serviceAreaLatitude'] as num?)?.toDouble() ?? 21.0368;
    final lng = (json['serviceAreaLongitude'] as num?)?.toDouble() ?? 105.7827;
    final radius = (json['serviceRadiusKm'] as num?)?.toInt() ?? 10;

    final rawHours = (json['workingHours'] as List<dynamic>?) ?? [];
    final hours = rawHours
        .whereType<Map<String, dynamic>>()
        .map((e) => ProviderWorkingHourEntity.fromJson(e))
        .toList();

    final rawServices = (json['services'] as List<dynamic>?) ?? [];
    final serviceIds = rawServices
        .whereType<Map<String, dynamic>>()
        .map((s) => s['id']?.toString() ?? '')
        .where((id) => id.isNotEmpty)
        .toList();

    return ProviderSetupEntity(
      serviceAreaName: areaName,
      serviceAreaLatitude: lat,
      serviceAreaLongitude: lng,
      serviceRadiusKm: radius,
      workingHours: hours,
      enabledServiceIds: serviceIds,
    );
  }

  Map<String, dynamic> toSaveDtoJson() {
    return {
      'serviceAreaName': serviceAreaName.isNotEmpty
          ? serviceAreaName
          : 'Hà Nội',
      'serviceAreaLatitude': serviceAreaLatitude,
      'serviceAreaLongitude': serviceAreaLongitude,
      'serviceRadiusKm': serviceRadiusKm > 0 ? serviceRadiusKm : 10,
      'workingHours': workingHours
          .where((h) => h.isWorking && h.endMinute > h.startMinute)
          .map((h) => h.toJson())
          .toList(),
      'enabledServiceIds': enabledServiceIds,
    };
  }

  @override
  List<Object?> get props => [
    serviceAreaName,
    serviceAreaLatitude,
    serviceAreaLongitude,
    serviceRadiusKm,
    workingHours,
    enabledServiceIds,
  ];
}

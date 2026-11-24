import 'package:equatable/equatable.dart';

class WorkerAvailabilitySessionEntity extends Equatable {
  final String id;
  final DateTime startedAt;
  final DateTime lastHeartbeatAt;

  const WorkerAvailabilitySessionEntity({
    required this.id,
    required this.startedAt,
    required this.lastHeartbeatAt,
  });

  factory WorkerAvailabilitySessionEntity.fromJson(Map<String, dynamic> json) {
    return WorkerAvailabilitySessionEntity(
      id: json['id']?.toString() ?? '',
      startedAt: DateTime.tryParse(json['startedAt']?.toString() ?? '') ?? DateTime.now(),
      lastHeartbeatAt: DateTime.tryParse(json['lastHeartbeatAt']?.toString() ?? '') ?? DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [id, startedAt, lastHeartbeatAt];
}

class WorkerAvailabilityEntity extends Equatable {
  final bool online;
  final WorkerAvailabilitySessionEntity? session;
  final int heartbeatTtlSeconds;

  const WorkerAvailabilityEntity({
    required this.online,
    this.session,
    this.heartbeatTtlSeconds = 120,
  });

  factory WorkerAvailabilityEntity.fromJson(Map<String, dynamic> json) {
    return WorkerAvailabilityEntity(
      online: json['online'] == true,
      session: json['session'] is Map
          ? WorkerAvailabilitySessionEntity.fromJson(Map<String, dynamic>.from(json['session'] as Map))
          : null,
      heartbeatTtlSeconds: (json['heartbeatTtlSeconds'] as num?)?.toInt() ?? 120,
    );
  }

  @override
  List<Object?> get props => [online, session, heartbeatTtlSeconds];
}

class WorkerReceivingSettingsEntity extends Equatable {
  final String memberId;
  final int receivingRadiusKm;
  final int organizationRadiusKm;
  final int effectiveRadiusKm;

  const WorkerReceivingSettingsEntity({
    required this.memberId,
    required this.receivingRadiusKm,
    required this.organizationRadiusKm,
    required this.effectiveRadiusKm,
  });

  factory WorkerReceivingSettingsEntity.fromJson(Map<String, dynamic> json) {
    return WorkerReceivingSettingsEntity(
      memberId: json['memberId']?.toString() ?? '',
      receivingRadiusKm: (json['receivingRadiusKm'] as num?)?.toInt() ?? 10,
      organizationRadiusKm: (json['organizationRadiusKm'] as num?)?.toInt() ?? 15,
      effectiveRadiusKm: (json['effectiveRadiusKm'] as num?)?.toInt() ?? 10,
    );
  }

  @override
  List<Object?> get props => [
    memberId,
    receivingRadiusKm,
    organizationRadiusKm,
    effectiveRadiusKm,
  ];
}


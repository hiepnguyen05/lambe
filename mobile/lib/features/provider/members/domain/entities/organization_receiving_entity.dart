import 'package:equatable/equatable.dart';

class OrganizationReceivingEntity extends Equatable {
  final String providerId;
  final bool enabled;
  final String providerStatus;

  const OrganizationReceivingEntity({
    required this.providerId,
    required this.enabled,
    required this.providerStatus,
  });

  factory OrganizationReceivingEntity.fromJson(Map<String, dynamic> json) {
    return OrganizationReceivingEntity(
      providerId: json['providerId']?.toString() ?? '',
      enabled: json['enabled'] == true,
      providerStatus: json['providerStatus']?.toString() ?? 'ACTIVE',
    );
  }

  @override
  List<Object?> get props => [providerId, enabled, providerStatus];
}


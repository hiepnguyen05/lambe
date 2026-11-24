import 'package:equatable/equatable.dart';

class ProviderMembershipOrganizationEntity extends Equatable {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final String providerType; // 'ORGANIZATION'
  final String status;

  const ProviderMembershipOrganizationEntity({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    required this.providerType,
    required this.status,
  });

  factory ProviderMembershipOrganizationEntity.fromJson(
    Map<String, dynamic> json,
  ) {
    return ProviderMembershipOrganizationEntity(
      id: json['id']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString(),
      providerType: json['providerType']?.toString() ?? 'ORGANIZATION',
      status: json['status']?.toString() ?? 'ACTIVE',
    );
  }

  @override
  List<Object?> get props => [id, displayName, avatarUrl, providerType, status];
}

class ProviderMembershipEntity extends Equatable {
  final String id;
  final String providerId;
  final String userId;
  final String role; // 'OWNER' | 'WORKER'
  final String status; // 'ACTIVE' | 'SUSPENDED' | 'LEFT'
  final bool canProvideServices;
  final String displayName;
  final String? avatarUrl;
  final DateTime joinedAt;
  final int membershipVersion;
  final String? verificationStatus;
  final ProviderMembershipOrganizationEntity? provider;

  const ProviderMembershipEntity({
    required this.id,
    required this.providerId,
    required this.userId,
    required this.role,
    required this.status,
    required this.canProvideServices,
    required this.displayName,
    this.avatarUrl,
    required this.joinedAt,
    required this.membershipVersion,
    this.verificationStatus,
    this.provider,
  });

  bool get isOwner => role == 'OWNER';
  bool get isWorker => role == 'WORKER';
  bool get isActive => status == 'ACTIVE';

  factory ProviderMembershipEntity.fromJson(Map<String, dynamic> json) {
    return ProviderMembershipEntity(
      id: json['id']?.toString() ?? '',
      providerId: json['providerId']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      role: json['role']?.toString() ?? 'WORKER',
      status: json['status']?.toString() ?? 'ACTIVE',
      canProvideServices: json['canProvideServices'] == true,
      displayName: json['displayName']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString(),
      joinedAt:
          DateTime.tryParse(json['joinedAt']?.toString() ?? '') ??
          DateTime.now(),
      membershipVersion:
          (json['membershipVersion'] as num?)?.toInt() ?? 1,
      verificationStatus: json['verificationStatus']?.toString(),
      provider: json['provider'] is Map<String, dynamic>
          ? ProviderMembershipOrganizationEntity.fromJson(
              Map<String, dynamic>.from(json['provider'] as Map),
            )
          : null,
    );
  }

  @override
  List<Object?> get props => [
    id,
    providerId,
    userId,
    role,
    status,
    canProvideServices,
    displayName,
    avatarUrl,
    joinedAt,
    membershipVersion,
    verificationStatus,
    provider,
  ];
}


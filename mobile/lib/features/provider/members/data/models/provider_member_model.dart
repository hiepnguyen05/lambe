import '../../domain/entities/provider_member_entity.dart';

class ProviderMemberModel extends ProviderMemberEntity {
  const ProviderMemberModel({
    required super.id,
    required super.providerId,
    required super.userId,
    required super.role,
    required super.status,
    required super.canProvideServices,
    required super.displayName,
    super.avatarUrl,
    required super.joinedAt,
    super.leftAt,
    required super.membershipVersion,
    super.verificationStatus,
    super.suspensionReason,
    super.suspensionSource,
  });

  factory ProviderMemberModel.fromJson(Map<String, dynamic> json) {
    return ProviderMemberModel(
      id: json['id']?.toString() ?? '',
      providerId: json['providerId']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      role: json['role']?.toString() ?? 'WORKER',
      status: json['status']?.toString() ?? 'PENDING_VERIFICATION',
      canProvideServices: json['canProvideServices'] == true,
      displayName: json['displayName']?.toString() ?? 'Thành viên',
      avatarUrl: json['avatarUrl']?.toString(),
      joinedAt: DateTime.tryParse(json['joinedAt']?.toString() ?? '') ??
          DateTime.now(),
      leftAt: json['leftAt'] != null
          ? DateTime.tryParse(json['leftAt'].toString())
          : null,
      membershipVersion: (json['membershipVersion'] as num?)?.toInt() ?? 1,
      verificationStatus: json['verificationStatus']?.toString(),
      suspensionReason: json['suspensionReason']?.toString(),
      suspensionSource: json['suspensionSource']?.toString(),
    );
  }
}

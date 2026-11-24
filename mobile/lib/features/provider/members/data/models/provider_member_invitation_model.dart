import '../../domain/entities/provider_member_invitation_entity.dart';

class ProviderMemberInvitationModel extends ProviderMemberInvitationEntity {
  const ProviderMemberInvitationModel({
    required super.id,
    required super.providerId,
    required super.phone,
    required super.status,
    required super.expiresAt,
    super.respondedAt,
    super.revokedAt,
    super.lastSentAt,
    required super.createdAt,
    super.token,
  });

  factory ProviderMemberInvitationModel.fromJson(Map<String, dynamic> json) {
    return ProviderMemberInvitationModel(
      id: json['id']?.toString() ?? '',
      providerId: json['providerId']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? '') ??
          DateTime.now().add(const Duration(days: 7)),
      respondedAt: json['respondedAt'] != null
          ? DateTime.tryParse(json['respondedAt'].toString())
          : null,
      revokedAt: json['revokedAt'] != null
          ? DateTime.tryParse(json['revokedAt'].toString())
          : null,
      lastSentAt: json['lastSentAt'] != null
          ? DateTime.tryParse(json['lastSentAt'].toString())
          : null,
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
      token: json['token']?.toString(),
    );
  }
}

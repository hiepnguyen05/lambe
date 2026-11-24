class ReceivedInvitationEntity {
  final String id;
  final String providerId;
  final String phone;
  final String status; // 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED'
  final DateTime expiresAt;
  final DateTime createdAt;
  final String providerDisplayName;
  final String? providerAvatarUrl;
  final String? providerServiceAreaName;

  const ReceivedInvitationEntity({
    required this.id,
    required this.providerId,
    required this.phone,
    required this.status,
    required this.expiresAt,
    required this.createdAt,
    required this.providerDisplayName,
    this.providerAvatarUrl,
    this.providerServiceAreaName,
  });

  bool get isPending => status == 'PENDING';
  bool get isExpired =>
      status == 'EXPIRED' || (isPending && expiresAt.isBefore(DateTime.now()));
  bool get isAccepted => status == 'ACCEPTED';
}

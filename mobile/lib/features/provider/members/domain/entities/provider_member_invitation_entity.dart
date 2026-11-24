class ProviderMemberInvitationEntity {
  final String id;
  final String providerId;
  final String phone;
  final String status; // 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'REVOKED'
  final DateTime expiresAt;
  final DateTime? respondedAt;
  final DateTime? revokedAt;
  final DateTime? lastSentAt;
  final DateTime createdAt;
  final String? token; // Chỉ xuất hiện ngay khi tạo hoặc cấp lại

  const ProviderMemberInvitationEntity({
    required this.id,
    required this.providerId,
    required this.phone,
    required this.status,
    required this.expiresAt,
    this.respondedAt,
    this.revokedAt,
    this.lastSentAt,
    required this.createdAt,
    this.token,
  });

  bool get isPending => status == 'PENDING';
  bool get isExpired =>
      status == 'EXPIRED' ||
      (isPending && expiresAt.isBefore(DateTime.now()));
  bool get isAccepted => status == 'ACCEPTED';
  bool get isRevoked => status == 'REVOKED';
  bool get isDeclined => status == 'DECLINED';
}

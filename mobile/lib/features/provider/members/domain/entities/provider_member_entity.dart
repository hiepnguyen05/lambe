class ProviderMemberEntity {
  final String id;
  final String providerId;
  final String userId;
  final String role; // 'OWNER' | 'WORKER'
  final String status; // 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'LEFT'
  final bool canProvideServices;
  final String displayName;
  final String? avatarUrl;
  final DateTime joinedAt;
  final DateTime? leftAt;
  final int membershipVersion;
  final String? verificationStatus; // 'DRAFT' | 'PENDING_REVIEW' | 'NEEDS_CHANGES' | 'APPROVED' | 'REJECTED'
  final String? suspensionReason;
  final String? suspensionSource;

  const ProviderMemberEntity({
    required this.id,
    required this.providerId,
    required this.userId,
    required this.role,
    required this.status,
    required this.canProvideServices,
    required this.displayName,
    this.avatarUrl,
    required this.joinedAt,
    this.leftAt,
    required this.membershipVersion,
    this.verificationStatus,
    this.suspensionReason,
    this.suspensionSource,
  });

  bool get isOwner => role == 'OWNER';
  bool get isWorker => role == 'WORKER';
  bool get isActive => status == 'ACTIVE';
  bool get isSuspended => status == 'SUSPENDED';
  bool get isPendingVerification => status == 'PENDING_VERIFICATION';
  bool get isLeft => status == 'LEFT';
}

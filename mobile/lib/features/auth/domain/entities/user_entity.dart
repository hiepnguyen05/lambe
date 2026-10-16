class UserEntity {
  final String id;
  final String? phone;
  final String? fullName;
  final String? avatarUrl;
  final String? gender;
  final String? onboardingStatus;
  final List<String> roles;

  const UserEntity({
    required this.id,
    this.phone,
    this.fullName,
    this.avatarUrl,
    this.gender,
    this.onboardingStatus,
    this.roles = const [],
  });

  UserEntity copyWith({
    String? id,
    String? phone,
    String? fullName,
    String? avatarUrl,
    String? gender,
    String? onboardingStatus,
    List<String>? roles,
  }) {
    return UserEntity(
      id: id ?? this.id,
      phone: phone ?? this.phone,
      fullName: fullName ?? this.fullName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      gender: gender ?? this.gender,
      onboardingStatus: onboardingStatus ?? this.onboardingStatus,
      roles: roles ?? this.roles,
    );
  }
}

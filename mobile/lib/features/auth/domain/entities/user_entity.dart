class UserEntity {
  final String id;
  final String phone;
  final String? fullName;
  final List<String> roles;
  final String status;

  const UserEntity({
    required this.id,
    required this.phone,
    this.fullName,
    required this.roles,
    required this.status,
  });
}

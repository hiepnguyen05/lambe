import '../../domain/entities/user_entity.dart';

class UserModel {
  final String id;
  final String? phone;
  final String? fullName;
  final String? avatarUrl;
  final String? gender;
  final String? onboardingStatus;

  const UserModel({
    required this.id,
    this.phone,
    this.fullName,
    this.avatarUrl,
    this.gender,
    this.onboardingStatus,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as String,
      phone: json['phone'] as String?,
      fullName: json['fullName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      gender: json['gender'] as String?,
      onboardingStatus: json['onboardingStatus'] as String?,
    );
  }

  UserEntity toEntity() {
    return UserEntity(
      id: id,
      phone: phone,
      fullName: fullName,
      avatarUrl: avatarUrl,
      gender: gender,
      onboardingStatus: onboardingStatus,
    );
  }
}

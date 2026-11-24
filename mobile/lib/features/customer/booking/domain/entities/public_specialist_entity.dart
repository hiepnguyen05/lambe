import 'package:equatable/equatable.dart';

class PublicSpecialistServiceEntity extends Equatable {
  final String providerServiceId;
  final String serviceId;
  final String name;
  final int priceAmount;
  final int durationMinutes;
  final String status;
  final String categoryId;

  const PublicSpecialistServiceEntity({
    required this.providerServiceId,
    required this.serviceId,
    required this.name,
    required this.priceAmount,
    required this.durationMinutes,
    required this.status,
    required this.categoryId,
  });

  factory PublicSpecialistServiceEntity.fromJson(Map<String, dynamic> json) {
    return PublicSpecialistServiceEntity(
      providerServiceId: json['providerServiceId']?.toString() ?? '',
      serviceId: json['serviceId']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      priceAmount: (json['priceAmount'] as num?)?.toInt() ?? 0,
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 60,
      status: json['status']?.toString() ?? 'ACTIVE',
      categoryId: json['categoryId']?.toString() ?? '',
    );
  }

  @override
  List<Object?> get props => [
        providerServiceId,
        serviceId,
        name,
        priceAmount,
        durationMinutes,
        status,
        categoryId,
      ];
}

class PublicSpecialistEntity extends Equatable {
  final String id;
  final String displayName;
  final String? avatarUrl;
  final int experienceYears;
  final int reviewCount;
  final double? averageRating;
  final List<PublicSpecialistServiceEntity> services;

  const PublicSpecialistEntity({
    required this.id,
    required this.displayName,
    this.avatarUrl,
    required this.experienceYears,
    required this.reviewCount,
    this.averageRating,
    this.services = const [],
  });

  factory PublicSpecialistEntity.fromJson(Map<String, dynamic> json) {
    final reviewMap = json['reviewSummary'] is Map
        ? Map<String, dynamic>.from(json['reviewSummary'] as Map)
        : null;
    final servicesList = json['services'] is List ? json['services'] as List : [];

    return PublicSpecialistEntity(
      id: json['id']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString(),
      experienceYears: (json['experienceYears'] as num?)?.toInt() ?? 1,
      reviewCount: (reviewMap?['count'] as num?)?.toInt() ?? 0,
      averageRating: (reviewMap?['averageRating'] as num?)?.toDouble(),
      services: servicesList
          .map((s) => PublicSpecialistServiceEntity.fromJson(
              Map<String, dynamic>.from(s as Map)))
          .toList(),
    );
  }

  @override
  List<Object?> get props => [
        id,
        displayName,
        avatarUrl,
        experienceYears,
        reviewCount,
        averageRating,
        services,
      ];
}


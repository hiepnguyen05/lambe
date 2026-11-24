import 'package:equatable/equatable.dart';

class MemberServiceOfferingEntity extends Equatable {
  final String providerServiceId;
  final String serviceId;
  final String name;
  final int priceAmount;
  final int durationMinutes;
  final String status;
  final String categoryId;
  final bool enabled;
  final bool eligible;
  final String? blockerCode;

  const MemberServiceOfferingEntity({
    required this.providerServiceId,
    required this.serviceId,
    required this.name,
    required this.priceAmount,
    required this.durationMinutes,
    required this.status,
    required this.categoryId,
    required this.enabled,
    required this.eligible,
    this.blockerCode,
  });

  factory MemberServiceOfferingEntity.fromJson(Map<String, dynamic> json) {
    return MemberServiceOfferingEntity(
      providerServiceId: json['providerServiceId']?.toString() ?? '',
      serviceId: json['serviceId']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      priceAmount: (json['priceAmount'] as num?)?.toInt() ?? 0,
      durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 60,
      status: json['status']?.toString() ?? 'ACTIVE',
      categoryId: json['categoryId']?.toString() ?? '',
      enabled: json['enabled'] == true,
      eligible: json['eligible'] == true,
      blockerCode: json['blockerCode']?.toString(),
    );
  }

  String get blockerLabel {
    switch (blockerCode) {
      case 'MEMBER_KYC_REQUIRED':
        return 'Chưa duyệt KYC';
      case 'SERVICE_NOT_VERIFIED':
        return 'Chưa đề nghị xác minh';
      case 'PRICE_OUT_OF_RANGE':
        return 'Giá ngoài khung quy định';
      case 'SERVICE_QUALIFICATION_INVALID':
        return 'Chứng chỉ nghề chưa hợp lệ';
      default:
        return 'Không đủ điều kiện';
    }
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
    enabled,
    eligible,
    blockerCode,
  ];
}


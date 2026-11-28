import 'package:equatable/equatable.dart';

enum SafetyRole { customer, provider }

enum SafetyReason {
  threat('THREAT', 'Đe dọa an toàn'),
  violence('VIOLENCE', 'Hành vi bạo lực'),
  theft('THEFT', 'Mất cắp / Tài sản'),
  medical('MEDICAL', 'Khẩn cấp y tế'),
  other('OTHER', 'Tình huống khác');

  final String apiValue;
  final String label;
  const SafetyReason(this.apiValue, this.label);

  static SafetyReason fromApi(String? value) {
    return SafetyReason.values.firstWhere(
      (item) => item.apiValue == value,
      orElse: () => SafetyReason.threat,
    );
  }
}

class SafetyReportSummary {
  final String id;
  final SafetyReason reason;
  final String? detail;
  final DateTime? createdAt;

  const SafetyReportSummary({
    required this.id,
    required this.reason,
    this.detail,
    this.createdAt,
  });

  factory SafetyReportSummary.fromJson(Map<String, dynamic> json) {
    return SafetyReportSummary(
      id: json['id']?.toString() ?? '',
      reason: SafetyReason.fromApi(json['reason']?.toString()),
      detail: json['detail']?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }
}

class SafetyScope extends Equatable {
  final String orderId;
  final SafetyRole role;
  const SafetyScope(this.orderId, this.role);
  String get path => role == SafetyRole.provider
      ? '/me/provider/orders/$orderId/safety'
      : '/me/orders/$orderId/safety';
  @override
  List<Object?> get props => [orderId, role];
}

bool canRaiseSafety(String status, {required SafetyRole role}) =>
    status == 'ARRIVED' ||
    status == 'IN_PROGRESS' ||
    (role == SafetyRole.provider && status == 'EN_ROUTE');

class SafetyIncident {
  final String id;
  final String status;
  final DateTime? closedAt;
  final bool ownReport;
  final List<SafetyReportSummary> reports;
  final List<String> evidenceIds;
  const SafetyIncident({
    required this.id,
    required this.status,
    this.closedAt,
    this.ownReport = false,
    this.reports = const [],
    this.evidenceIds = const [],
  });
  bool get isOpen => status == 'OPEN';
  factory SafetyIncident.fromJson(Map<String, dynamic> json) {
    if (json['id'] is! String ||
        !const {'OPEN', 'CLOSED'}.contains(json['status'])) {
      throw const FormatException('Hồ sơ an toàn không hợp lệ.');
    }
    final parsedReports = (json['reports'] as List? ?? [])
        .whereType<Map>()
        .map(
          (row) => SafetyReportSummary.fromJson(Map<String, dynamic>.from(row)),
        )
        .toList();
    return SafetyIncident(
      id: json['id'] as String,
      status: json['status'] as String,
      closedAt: DateTime.tryParse(json['closedAt']?.toString() ?? ''),
      ownReport: parsedReports.isNotEmpty,
      reports: parsedReports,
      evidenceIds: (json['evidence'] as List? ?? [])
          .map((row) => (row as Map)['id'] as String)
          .toList(),
    );
  }
}

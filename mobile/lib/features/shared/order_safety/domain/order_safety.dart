import 'package:equatable/equatable.dart';

enum SafetyRole { customer, provider }

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

bool canRaiseSafety(String status) =>
    const {'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'}.contains(status);

class SafetyIncident {
  final String id;
  final String status;
  final DateTime? closedAt;
  final bool ownReport;
  final List<String> evidenceIds;
  const SafetyIncident({
    required this.id,
    required this.status,
    this.closedAt,
    this.ownReport = false,
    this.evidenceIds = const [],
  });
  bool get isOpen => status == 'OPEN';
  factory SafetyIncident.fromJson(Map<String, dynamic> json) {
    if (json['id'] is! String ||
        !const {'OPEN', 'CLOSED'}.contains(json['status'])) {
      throw const FormatException('Hồ sơ an toàn không hợp lệ.');
    }
    return SafetyIncident(
      id: json['id'] as String,
      status: json['status'] as String,
      closedAt: DateTime.tryParse(json['closedAt']?.toString() ?? ''),
      ownReport: (json['reports'] as List?)?.isNotEmpty == true,
      evidenceIds: (json['evidence'] as List? ?? [])
          .map((row) => (row as Map)['id'] as String)
          .toList(),
    );
  }
}

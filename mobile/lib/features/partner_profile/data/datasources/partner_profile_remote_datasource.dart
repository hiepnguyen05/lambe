import 'package:dio/dio.dart';

import '../../../../core/network/api_response_parser.dart';
import '../../domain/entities/partner_profile_entity.dart';

abstract class PartnerProfileRemoteDataSource {
  Future<PartnerProfileEntity?> getProfile();
}

class DioPartnerProfileRemoteDataSource
    implements PartnerProfileRemoteDataSource {
  final Dio _dio;

  DioPartnerProfileRemoteDataSource(this._dio);

  @override
  Future<PartnerProfileEntity?> getProfile() async {
    try {
      final response = await _dio.get('/me/provider/setup');
      final data = ApiResponseParser.dataMap(response);

      final id = data['id']?.toString() ?? '';
      final displayName =
          data['displayName']?.toString() ?? 'Chuyên viên đối tác';
      final biography = data['biography']?.toString() ?? '';
      final serviceAreaName =
          data['serviceAreaName']?.toString() ?? 'Chưa thiết lập';
      final serviceRadiusKm = (data['serviceRadiusKm'] as num?)?.toInt() ?? 0;

      // Parse services
      final servicesList = (data['services'] as List<dynamic>?) ?? [];
      final activeServices = servicesList
          .where((s) => s['status'] == 'ACTIVE' || s['status'] == 'APPROVED')
          .toList();
      final activeCount = activeServices.isNotEmpty
          ? activeServices.length
          : servicesList.length;

      final serviceNames = servicesList
          .map((s) => s['service']?['name']?.toString() ?? '')
          .where((n) => n.isNotEmpty)
          .take(3)
          .join(', ');

      final summary = serviceNames.isNotEmpty
          ? serviceNames
          : 'Chưa có dịch vụ hoạt động';

      // Parse working hours
      final rawHours = (data['workingHours'] as List<dynamic>?) ?? [];
      final workingHoursSummary = _formatWorkingHours(rawHours);

      return PartnerProfileEntity(
        id: id,
        displayName: displayName,
        biography: biography,
        serviceAreaName: serviceAreaName,
        serviceRadiusKm: serviceRadiusKm,
        activeServicesCount: activeCount,
        servicesSummary: summary,
        workingHoursSummary: workingHoursSummary,
      );
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  String _formatWorkingHours(List<dynamic> hours) {
    if (hours.isEmpty) {
      return 'Chưa thiết lập lịch làm việc';
    }
    try {
      final first = hours.first;
      final startMin = (first['startMinute'] as num?)?.toInt() ?? 510;
      final endMin = (first['endMinute'] as num?)?.toInt() ?? 1230;

      final startHourStr = (startMin ~/ 60).toString().padLeft(2, '0');
      final startMinuteStr = (startMin % 60).toString().padLeft(2, '0');
      final endHourStr = (endMin ~/ 60).toString().padLeft(2, '0');
      final endMinuteStr = (endMin % 60).toString().padLeft(2, '0');

      return 'T2 - CN • $startHourStr:$startMinuteStr - $endHourStr:$endMinuteStr';
    } catch (_) {
      return 'Chưa thiết lập lịch làm việc';
    }
  }
}

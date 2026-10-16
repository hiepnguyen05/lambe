import 'package:dio/dio.dart';
import '../../../../../core/network/api_response_parser.dart';

abstract class ProviderDashboardRemoteDataSource {
  Future<bool> getAvailability();
  Future<void> goOnline(double latitude, double longitude);
  Future<void> goOffline();
  Future<int> getSetupRadius();
  Future<void> updateSetupRadius(int radiusKm);
}

class DioProviderDashboardRemoteDataSource implements ProviderDashboardRemoteDataSource {
  final Dio _dio;

  DioProviderDashboardRemoteDataSource(this._dio);

  @override
  Future<bool> getAvailability() async {
    try {
      final response = await _dio.get('/me/provider/availability');
      final data = ApiResponseParser.dataMap(response);
      return data['online'] == true;
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 404) {
        return false;
      }
      rethrow;
    }
  }

  @override
  Future<void> goOnline(double latitude, double longitude) async {
    final response = await _dio.post(
      '/me/provider/availability/online',
      data: {
        'latitude': latitude,
        'longitude': longitude,
      },
    );
    ApiResponseParser.dataMap(response);
  }

  @override
  Future<void> goOffline() async {
    final response = await _dio.post('/me/provider/availability/offline');
    ApiResponseParser.dataMap(response);
  }

  @override
  Future<int> getSetupRadius() async {
    try {
      final response = await _dio.get('/me/provider/setup');
      final data = ApiResponseParser.dataMap(response);
      return (data['serviceRadiusKm'] as num?)?.toInt() ?? 5;
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 404) {
        return 5;
      }
      rethrow;
    }
  }

  @override
  Future<void> updateSetupRadius(int radiusKm) async {
    final getRes = await _dio.get('/me/provider/setup');
    final currentData = ApiResponseParser.dataMap(getRes);

    final servicesList = (currentData['services'] as List<dynamic>?) ?? [];
    final activeServiceIds = servicesList
        .where((s) => s['status'] == 'ACTIVE' || s['status'] == 'APPROVED')
        .map((s) => s['id'] as String)
        .toList();
    final allServiceIds = servicesList.map((s) => s['id'] as String).toList();
    final enabledServiceIds = activeServiceIds.isNotEmpty ? activeServiceIds : allServiceIds;

    final rawWorkingHours = (currentData['workingHours'] as List<dynamic>?) ?? [];
    final workingHours = rawWorkingHours.map((w) => {
      'dayOfWeek': (w['dayOfWeek'] as num).toInt(),
      'startMinute': (w['startMinute'] as num).toInt(),
      'endMinute': (w['endMinute'] as num).toInt(),
    }).toList();

    final payload = {
      'serviceAreaName': currentData['serviceAreaName']?.toString() ?? 'Khu vực hoạt động',
      'serviceAreaLatitude': (currentData['serviceAreaLatitude'] as num?)?.toDouble() ?? 21.0285,
      'serviceAreaLongitude': (currentData['serviceAreaLongitude'] as num?)?.toDouble() ?? 105.8542,
      'serviceRadiusKm': radiusKm,
      'workingHours': workingHours.isNotEmpty
          ? workingHours
          : [
              {'dayOfWeek': 1, 'startMinute': 480, 'endMinute': 1020},
              {'dayOfWeek': 2, 'startMinute': 480, 'endMinute': 1020},
              {'dayOfWeek': 3, 'startMinute': 480, 'endMinute': 1020},
              {'dayOfWeek': 4, 'startMinute': 480, 'endMinute': 1020},
              {'dayOfWeek': 5, 'startMinute': 480, 'endMinute': 1020},
            ],
      'enabledServiceIds': enabledServiceIds,
    };

    final response = await _dio.put(
      '/me/provider/setup',
      data: payload,
    );
    ApiResponseParser.dataMap(response);
  }
}

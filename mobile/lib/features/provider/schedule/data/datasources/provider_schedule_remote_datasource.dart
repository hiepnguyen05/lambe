import 'package:dio/dio.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../../domain/entities/provider_calendar_block_entity.dart';
import '../../domain/entities/provider_setup_entity.dart';
import '../../domain/entities/provider_working_hour_entity.dart';

abstract class ProviderScheduleRemoteDataSource {
  Future<ProviderSetupEntity> getSetup();
  Future<void> updateWorkingHours(List<ProviderWorkingHourEntity> workingHours);
  Future<List<ProviderCalendarBlockEntity>> getCalendar({
    required DateTime from,
    required DateTime to,
  });
  Future<ProviderCalendarBlockEntity> createTimeOff({
    required DateTime from,
    required DateTime to,
    required String reason,
  });
  Future<void> deleteTimeOff(String id);
}

class DioProviderScheduleRemoteDataSource
    implements ProviderScheduleRemoteDataSource {
  final Dio _dio;

  DioProviderScheduleRemoteDataSource(this._dio);

  @override
  Future<ProviderSetupEntity> getSetup() async {
    final response = await _dio.get(ApiEndpoints.providerSetup);
    final data = ApiResponseParser.dataMap(response);
    return ProviderSetupEntity.fromJson(data);
  }

  @override
  Future<void> updateWorkingHours(
    List<ProviderWorkingHourEntity> workingHours,
  ) async {
    // 1. Fetch existing setup to retain area, coordinates, radius, and services
    final currentSetup = await getSetup();

    // 2. Build updated payload
    final updatedSetup = currentSetup.copyWith(workingHours: workingHours);
    final payload = updatedSetup.toSaveDtoJson();

    // 3. Put to backend
    await _dio.put(ApiEndpoints.providerSetup, data: payload);
  }

  @override
  Future<List<ProviderCalendarBlockEntity>> getCalendar({
    required DateTime from,
    required DateTime to,
  }) async {
    final response = await _dio.get(
      ApiEndpoints.providerCalendar,
      queryParameters: {
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
      },
    );

    final list = ApiResponseParser.dataList(response);
    return list
        .whereType<Map<String, dynamic>>()
        .map((e) => ProviderCalendarBlockEntity.fromJson(e))
        .toList();
  }

  @override
  Future<ProviderCalendarBlockEntity> createTimeOff({
    required DateTime from,
    required DateTime to,
    required String reason,
  }) async {
    final response = await _dio.post(
      ApiEndpoints.providerTimeOff,
      data: {
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
        'reason': reason.trim(),
      },
    );

    final data = ApiResponseParser.dataMap(response);
    return ProviderCalendarBlockEntity.fromJson(data);
  }

  @override
  Future<void> deleteTimeOff(String id) async {
    await _dio.delete(ApiEndpoints.providerTimeOffItem(id));
  }
}

import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../domain/guidance_progress.dart';

class GuidanceRepository {
  final Dio dio;
  final FlutterSecureStorage storage;
  const GuidanceRepository(this.dio, this.storage);

  Future<Map<String, GuidanceProgress>> load(
    String userId,
    CancelToken cancel,
  ) async {
    final records = <String, GuidanceProgress>{};
    try {
      final raw = await storage.read(key: 'guidance:$userId');
      if (raw != null) {
        for (final row
            in (jsonDecode(raw) as List).whereType<Map<String, dynamic>>()) {
          final progress = GuidanceProgress.fromJson(row);
          records[progress.tourId] = progress;
        }
      }
    } catch (_) {
      /* Invalid optional cache must not block the app. */
    }
    try {
      final response = await dio.get('/me/guidance', cancelToken: cancel);
      for (final raw in ApiResponseParser.dataList(
        response,
      ).whereType<Map<String, dynamic>>()) {
        final progress = GuidanceProgress.fromJson(raw);
        final local = records[progress.tourId];
        if (local == null ||
            progress.version > local.version ||
            (progress.version == local.version && !local.pendingSync)) {
          records[progress.tourId] = progress;
        }
      }
      for (final pending
          in records.values.where((p) => p.pendingSync).toList()) {
        records[pending.tourId] = await saveRemote(pending, cancel);
      }
      if (!cancel.isCancelled) await cache(userId, records);
    } catch (_) {
      /* Pending local progress is retried by the controller. */
    }
    return records;
  }

  Future<void> cache(String userId, Map<String, GuidanceProgress> records) =>
      storage.write(
        key: 'guidance:$userId',
        value: jsonEncode(records.values.map((p) => p.toJson()).toList()),
      );

  Future<GuidanceProgress> saveRemote(
    GuidanceProgress progress,
    CancelToken? cancel,
  ) async {
    final response = await dio.put(
      '/me/guidance/${progress.tourId}',
      data: {
        'version': progress.version,
        'stepIndex': progress.stepIndex,
        'status': progress.status,
      },
      cancelToken: cancel,
    );
    return GuidanceProgress.fromJson(ApiResponseParser.dataMap(response));
  }
}

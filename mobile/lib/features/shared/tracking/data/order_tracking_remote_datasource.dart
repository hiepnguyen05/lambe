import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../domain/order_tracking_snapshot.dart';

class OrderTrackingRemoteDataSource {
  final Dio _dio;

  OrderTrackingRemoteDataSource(this._dio);

  Future<OrderTrackingSnapshot?> sendProviderPosition(
    String orderId,
    Position position, {
    CancelToken? cancelToken,
  }) async {
    final response = await _dio.put<Map<String, dynamic>>(
      ApiEndpoints.providerOrderLocation(orderId),
      cancelToken: cancelToken,
      data: {
        'latitude': position.latitude,
        'longitude': position.longitude,
        'accuracyMeters': position.accuracy,
        'capturedAt': position.timestamp.toUtc().toIso8601String(),
        if (position.heading >= 0 && position.heading <= 360)
          'headingDegrees': position.heading,
      },
    );
    final data = response.data?['data'];
    if (data is! Map<String, dynamic> || data['accepted'] != true) {
      return null;
    }
    final tracking = data['tracking'];
    return tracking is Map<String, dynamic>
        ? OrderTrackingSnapshot.fromJson(tracking)
        : null;
  }

  Future<OrderTrackingSnapshot> getSnapshot(String orderId) async {
    final response = await _dio.get<Map<String, dynamic>>(
      ApiEndpoints.orderTracking(orderId),
    );
    final data = response.data?['data'];
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Invalid tracking response');
    }
    return OrderTrackingSnapshot.fromJson(data);
  }

  Future<Map<String, dynamic>> getProviderOrder(
    String orderId,
    CancelToken cancelToken,
  ) async => ApiResponseParser.dataMap(
    await _dio.get(
      ApiEndpoints.meProviderOrder(orderId),
      cancelToken: cancelToken,
    ),
  );

  Stream<OrderTrackingSnapshot> watch(
    String orderId,
    CancelToken cancelToken,
  ) async* {
    while (!cancelToken.isCancelled) {
      try {
        final response = await _dio.get<ResponseBody>(
          ApiEndpoints.orderTrackingEvents(orderId),
          options: Options(
            responseType: ResponseType.stream,
            receiveTimeout: Duration.zero,
            headers: {'Accept': 'text/event-stream'},
          ),
          cancelToken: cancelToken,
        );
        final body = response.data;
        if (body != null) {
          await for (final line
              in utf8.decoder
                  .bind(body.stream)
                  .transform(const LineSplitter())) {
            if (!line.startsWith('data: ')) continue;
            try {
              final data = jsonDecode(line.substring(6));
              if (data is Map<String, dynamic>) {
                final snapshot = OrderTrackingSnapshot.fromJson(data);
                yield snapshot;
                if (snapshot.status == 'INACTIVE') return;
              }
            } catch (formatError) {
              debugPrint('[OrderTracking] Malformed SSE event data: $formatError');
            }
          }
        }
      } on DioException catch (error) {
        if (cancelToken.isCancelled) return;
        if (error.response?.statusCode == 401 ||
            error.response?.statusCode == 404) {
          rethrow;
        }
        try {
          yield await getSnapshot(orderId);
        } on DioException catch (fallbackError) {
          if (fallbackError.response?.statusCode == 401 ||
              fallbackError.response?.statusCode == 404) {
            rethrow;
          }
        } catch (fallbackError) {
          debugPrint('[OrderTracking] Fallback snapshot after DioException failed: $fallbackError');
        }
      } catch (error) {
        if (cancelToken.isCancelled) return;
        debugPrint('[OrderTracking] Unexpected stream error: $error');
        try {
          yield await getSnapshot(orderId);
        } catch (fallbackError) {
          debugPrint('[OrderTracking] Fallback snapshot after error failed: $fallbackError');
        }
      }
      if (!cancelToken.isCancelled) {
        await Future<void>.delayed(const Duration(seconds: 2));
      }
    }
  }
}

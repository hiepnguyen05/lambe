import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';

import '../domain/entities/service_recommendations_entity.dart';

final serviceRecommendationsProvider =
    FutureProvider.autoDispose<ServiceRecommendationsEntity>((ref) async {
      final dio = ref.watch(dioProvider);
      final response = await dio.get(
        ApiEndpoints.serviceRecommendations,
        queryParameters: {'limit': 12},
      );
      final data = ApiResponseParser.dataMap(response);
      return ServiceRecommendationsEntity.fromJson(data);
    });

import 'package:dio/dio.dart';
import 'package:mobile/core/network/api_response_parser.dart';

Future<Map<String, dynamic>> loadProviderReadiness(
  Dio dio,
  CancelToken cancel,
) async {
  final response = await dio.get(
    '/me/provider/availability',
    cancelToken: cancel,
  );
  return Map<String, dynamic>.from(
    ApiResponseParser.dataMap(response)['receivingEligibility'] as Map,
  );
}

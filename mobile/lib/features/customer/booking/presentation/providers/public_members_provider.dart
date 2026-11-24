import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';
import '../../domain/entities/public_specialist_entity.dart';

final publicMembersProvider =
    FutureProvider.family<List<PublicSpecialistEntity>, String>(
  (ref, providerId) async {
    final dio = ref.watch(dioProvider);
    final response = await dio.get('/providers/$providerId/members');
    final list = ApiResponseParser.dataList(response);
    return list
        .map((item) => PublicSpecialistEntity.fromJson(
            Map<String, dynamic>.from(item as Map)))
        .toList();
  },
);

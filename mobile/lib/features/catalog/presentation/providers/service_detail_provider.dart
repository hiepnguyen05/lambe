import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../../../core/network/dio_client.dart';
import '../../domain/entities/nearby_technician_entity.dart';
import '../../domain/entities/service_item_entity.dart';
import 'catalog_providers.dart';

/// Provider lấy chi tiết dịch vụ theo slug từ backend
final serviceDetailBySlugProvider =
    FutureProvider.family<ServiceItemEntity, String>((ref, slug) async {
  final repository = ref.watch(catalogRepositoryProvider);
  return repository.getServiceBySlug(slug);
});

/// Provider lấy danh sách chuyên viên gần bạn cho dịch vụ đang xem từ backend API
final nearbyTechniciansProvider =
    FutureProvider.family<List<NearbyTechnicianEntity>, String>((ref, serviceId) async {
  final dio = ref.watch(dioProvider);

  try {
    final response = await dio.post(
      ApiEndpoints.providerDiscoverySearch,
      data: {
        'serviceId': serviceId,
        'latitude': 10.7731, // Tọa độ trung tâm mặc định TP.HCM nếu chưa lấy GPS
        'longitude': 106.703,
        'radiusKm': 30,
        'limit': 10,
        'bookingType': 'SCHEDULED', // SCHEDULED tìm chuyên viên theo khu vực đăng ký dịch vụ
      },
      options: Options(
        validateStatus: (status) => status != null && status < 500,
      ),
    );

    if (response.statusCode == 200) {
      final list = ApiResponseParser.dataList(response);
      return list
          .map((item) =>
              NearbyTechnicianEntity.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList();
    }
  } catch (_) {
    // Không kết nối được hoặc lỗi mạng
  }

  // Trả về danh sách rỗng từ dữ liệu thật, không dùng mock
  return const <NearbyTechnicianEntity>[];
});

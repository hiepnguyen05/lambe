import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../../../core/network/dio_client.dart';

class HomeCategoryItem {
  final String id;
  final String code;
  final String name;
  final String slug;
  final String? description;
  final String? iconUrl;
  final String? coverImageUrl;
  final int sortOrder;

  const HomeCategoryItem({
    required this.id,
    required this.code,
    required this.name,
    required this.slug,
    this.description,
    this.iconUrl,
    this.coverImageUrl,
    this.sortOrder = 0,
  });

  factory HomeCategoryItem.fromJson(Map<String, dynamic> json) {
    return HomeCategoryItem(
      id: json['id'] as String? ?? '',
      code: json['code'] as String? ?? '',
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      description: json['description'] as String?,
      iconUrl: json['iconUrl'] as String?,
      coverImageUrl: json['coverImageUrl'] as String?,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Provider kết nối trực tiếp với API thật GET /categories
final homeCategoriesProvider = FutureProvider<List<HomeCategoryItem>>((ref) async {
  final dio = ref.watch(dioProvider);

  try {
    final response = await dio.get(ApiEndpoints.categories);
    final dataList = ApiResponseParser.dataList(response);

    return dataList
        .map((item) => HomeCategoryItem.fromJson(item as Map<String, dynamic>))
        .toList();
  } catch (e, stack) {
    // Log lỗi để dễ debug, vẫn trả danh sách trống để UI không crash
    debugPrint('⚠️ Failed to fetch categories: $e\n$stack');
    return const [];
  }
});

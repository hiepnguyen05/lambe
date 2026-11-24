import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';

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

/// Danh mục dịch vụ chuẩn theo mô hình thiết kế
const List<HomeCategoryItem> kDefaultCoreCategories = [
  HomeCategoryItem(
    id: 'nail',
    code: 'NAIL',
    name: 'Làm Nail & Móng',
    slug: 'nail-mong',
    iconUrl: 'brush',
    sortOrder: 1,
  ),
  HomeCategoryItem(
    id: 'skincare',
    code: 'SKINCARE',
    name: 'Chăm sóc Da & Spa',
    slug: 'cham-soc-da-spa',
    iconUrl: 'spa',
    sortOrder: 2,
  ),
  HomeCategoryItem(
    id: 'haircut',
    code: 'HAIRCUT',
    name: 'Cắt & Tạo kiểu',
    slug: 'cat-tao-kieu',
    iconUrl: 'content_cut',
    sortOrder: 3,
  ),
  HomeCategoryItem(
    id: 'massage',
    code: 'MASSAGE',
    name: 'Massage Thư giãn',
    slug: 'massage-thu-gian',
    iconUrl: 'self_improvement',
    sortOrder: 4,
  ),
  HomeCategoryItem(
    id: 'shampoo',
    code: 'SHAMPOO',
    name: 'Gội Dưỡng Sinh',
    slug: 'goi-duong-sinh',
    iconUrl: 'water_drop',
    sortOrder: 5,
  ),
  HomeCategoryItem(
    id: 'makeup',
    code: 'MAKEUP',
    name: 'Trang điểm & Mi',
    slug: 'trang-diem-mi',
    iconUrl: 'face_retouching_natural',
    sortOrder: 6,
  ),
  HomeCategoryItem(
    id: 'waxing',
    code: 'WAXING',
    name: 'Waxing & Triệt lông',
    slug: 'waxing-triet-long',
    iconUrl: 'auto_awesome',
    sortOrder: 7,
  ),
  HomeCategoryItem(
    id: 'aesthetic',
    code: 'AESTHETIC',
    name: 'Thẩm mỹ & Khác',
    slug: 'tham-my-khac',
    iconUrl: 'health_and_beauty',
    sortOrder: 8,
  ),
];

/// Provider kết nối trực tiếp với API thật GET /categories
final homeCategoriesProvider = FutureProvider<List<HomeCategoryItem>>((
  ref,
) async {
  final dio = ref.watch(dioProvider);

  try {
    final response = await dio.get(ApiEndpoints.categories);
    final dataList = ApiResponseParser.dataList(response);

    if (dataList.isEmpty) {
      return kDefaultCoreCategories;
    }

    return dataList
        .map((item) => HomeCategoryItem.fromJson(item as Map<String, dynamic>))
        .toList();
  } catch (e, stack) {
    debugPrint('⚠️ Failed to fetch categories: $e\n$stack');
    return kDefaultCoreCategories;
  }
});

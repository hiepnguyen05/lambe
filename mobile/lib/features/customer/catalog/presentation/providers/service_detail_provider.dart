import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/service_item_entity.dart';
import './catalog_providers.dart';

/// Provider lấy chi tiết dịch vụ theo slug từ backend (tự làm mới mỗi lần mở màn hình)
final serviceDetailBySlugProvider =
    FutureProvider.autoDispose.family<ServiceItemEntity, String>((ref, slug) async {
      final repository = ref.watch(catalogRepositoryProvider);
      return repository.getServiceBySlug(slug);
    });

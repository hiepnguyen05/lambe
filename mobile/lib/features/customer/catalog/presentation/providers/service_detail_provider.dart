import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/service_item_entity.dart';
import './catalog_providers.dart';

/// Provider lấy chi tiết dịch vụ theo slug từ backend
final serviceDetailBySlugProvider =
    FutureProvider.family<ServiceItemEntity, String>((ref, slug) async {
      final repository = ref.watch(catalogRepositoryProvider);
      return repository.getServiceBySlug(slug);
    });

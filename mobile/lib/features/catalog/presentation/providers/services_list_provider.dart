import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/service_filter_params.dart';
import '../../domain/entities/service_item_entity.dart';
import 'catalog_providers.dart';
import 'service_filter_provider.dart';

/// Provider lấy toàn bộ danh sách dịch vụ của salon để hỗ trợ tìm kiếm siêu tốc & lọc tức thì
final allCatalogServicesProvider =
    FutureProvider.autoDispose<List<ServiceItemEntity>>((ref) async {
  final repository = ref.watch(catalogRepositoryProvider);
  return repository.getServices(const ServiceFilterParams());
});

/// Provider lấy danh sách dịch vụ theo bộ lọc server
final servicesListProvider =
    FutureProvider.autoDispose<List<ServiceItemEntity>>((ref) async {
  final repository = ref.watch(catalogRepositoryProvider);
  final filter = ref.watch(serviceFilterProvider);
  return repository.getServices(filter);
});

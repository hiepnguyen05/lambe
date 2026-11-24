import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/service_item_entity.dart';

class SelectedServicesNotifier extends StateNotifier<Set<ServiceItemEntity>> {
  SelectedServicesNotifier() : super({});

  void toggle(ServiceItemEntity service) {
    final existing = state.any((s) => s.id == service.id);
    if (existing) {
      state = state.where((s) => s.id != service.id).toSet();
    } else {
      state = {...state, service};
    }
  }

  bool isSelected(ServiceItemEntity service) {
    return state.any((s) => s.id == service.id);
  }

  void select(ServiceItemEntity service) {
    if (!isSelected(service)) {
      state = {...state, service};
    }
  }

  void deselect(ServiceItemEntity service) {
    state = state.where((s) => s.id != service.id).toSet();
  }

  void clear() {
    state = {};
  }
}

final selectedServicesProvider =
    StateNotifierProvider.autoDispose<
      SelectedServicesNotifier,
      Set<ServiceItemEntity>
    >((ref) {
      return SelectedServicesNotifier();
    });

final totalSelectedPriceProvider = Provider.autoDispose<int>((ref) {
  final selected = ref.watch(selectedServicesProvider);
  return selected.fold<int>(0, (sum, item) => sum + item.minPriceAmount);
});

final selectedServicesCountProvider = Provider.autoDispose<int>((ref) {
  final selected = ref.watch(selectedServicesProvider);
  return selected.length;
});

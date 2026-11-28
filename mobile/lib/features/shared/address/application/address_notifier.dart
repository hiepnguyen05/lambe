import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/address_entity.dart';
import '../domain/repositories/address_repository.dart';

class AddressNotifier extends StateNotifier<AsyncValue<List<AddressEntity>>> {
  final AddressRepository _repository;

  AddressNotifier(this._repository, {bool autoLoad = true})
    : super(
        autoLoad ? const AsyncValue.loading() : const AsyncValue.data([]),
      ) {
    if (autoLoad) {
      fetchAddresses();
    }
  }

  Future<void> fetchAddresses() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getAddresses();
      if (!mounted) return;
      state = AsyncValue.data(list);
    } catch (error, stack) {
      if (!mounted) return;
      state = AsyncValue.error(error, stack);
    }
  }

  Future<void> createAddress(AddressEntity address) async {
    final created = await _repository.createAddress(address);
    if (!mounted) return;
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncValue.data([...current, created]);
    }
  }

  Future<void> updateAddress(String id, AddressEntity address) async {
    final updated = await _repository.updateAddress(id, address);
    if (!mounted) return;
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncValue.data(
        current.map((item) => item.id == id ? updated : item).toList(),
      );
    }
  }

  Future<void> deleteAddress(String id) async {
    await _repository.deleteAddress(id);
    if (!mounted) return;
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncValue.data(
        current.where((item) => item.id != id).toList(),
      );
    }
  }

  Future<void> setDefaultAddress(String id) async {
    await _repository.setDefaultAddress(id);
    if (!mounted) return;
    final current = state.valueOrNull;
    if (current != null) {
      state = AsyncValue.data(
        current
            .map((item) => item.copyWith(isDefault: item.id == id))
            .toList(),
      );
    }
  }
}

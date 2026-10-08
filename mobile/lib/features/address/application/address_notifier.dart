import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/address_entity.dart';
import '../domain/repositories/address_repository.dart';

class AddressNotifier extends StateNotifier<AsyncValue<List<AddressEntity>>> {
  final AddressRepository _repository;

  AddressNotifier(this._repository) : super(const AsyncValue.loading()) {
    fetchAddresses();
  }

  Future<void> fetchAddresses() async {
    state = const AsyncValue.loading();
    try {
      state = AsyncValue.data(await _repository.getAddresses());
    } catch (error, stack) {
      state = AsyncValue.error(error, stack);
    }
  }

  Future<void> createAddress(AddressEntity address) async {
    final created = await _repository.createAddress(address);
    if (state.hasValue) {
      state = AsyncValue.data([...state.value!, created]);
    }
  }

  Future<void> updateAddress(String id, AddressEntity address) async {
    final updated = await _repository.updateAddress(id, address);
    if (state.hasValue) {
      state = AsyncValue.data(
        state.value!.map((item) => item.id == id ? updated : item).toList(),
      );
    }
  }

  Future<void> deleteAddress(String id) async {
    await _repository.deleteAddress(id);
    if (state.hasValue) {
      state = AsyncValue.data(
        state.value!.where((item) => item.id != id).toList(),
      );
    }
  }

  Future<void> setDefaultAddress(String id) async {
    await _repository.setDefaultAddress(id);
    if (state.hasValue) {
      state = AsyncValue.data(
        state.value!
            .map((item) => item.copyWith(isDefault: item.id == id))
            .toList(),
      );
    }
  }
}

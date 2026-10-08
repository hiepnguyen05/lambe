import '../entities/address_entity.dart';

abstract class AddressRepository {
  Future<List<AddressEntity>> getAddresses();
  Future<AddressEntity> createAddress(AddressEntity address);
  Future<AddressEntity> updateAddress(String id, AddressEntity address);
  Future<void> setDefaultAddress(String id);
  Future<void> deleteAddress(String id);
}

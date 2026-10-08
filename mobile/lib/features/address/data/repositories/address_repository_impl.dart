import '../../domain/entities/address_entity.dart';
import '../../domain/repositories/address_repository.dart';
import '../datasources/address_remote_datasource.dart';
import '../models/address_model.dart';

class AddressRepositoryImpl implements AddressRepository {
  final AddressRemoteDataSource remoteDataSource;

  AddressRepositoryImpl(this.remoteDataSource);

  @override
  Future<List<AddressEntity>> getAddresses() async {
    final list = await remoteDataSource.getAddresses();
    return list
        .map(
          (json) =>
              AddressModel.fromJson(Map<String, dynamic>.from(json as Map)),
        )
        .toList();
  }

  @override
  Future<AddressEntity> createAddress(AddressEntity address) async {
    final result = await remoteDataSource.createAddress(
      AddressModel.toJson(address),
    );
    return AddressModel.fromJson(result);
  }

  @override
  Future<AddressEntity> updateAddress(String id, AddressEntity address) async {
    final result = await remoteDataSource.updateAddress(
      id,
      AddressModel.toJson(address),
    );
    return AddressModel.fromJson(result);
  }

  @override
  Future<void> setDefaultAddress(String id) async {
    await remoteDataSource.setDefaultAddress(id);
  }

  @override
  Future<void> deleteAddress(String id) async {
    await remoteDataSource.deleteAddress(id);
  }
}

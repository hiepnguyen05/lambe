abstract interface class AddressRemoteDataSource {
  Future<List<dynamic>> getAddresses();
  Future<Map<String, dynamic>> createAddress(Map<String, dynamic> data);
  Future<Map<String, dynamic>> updateAddress(
    String id,
    Map<String, dynamic> data,
  );
  Future<void> setDefaultAddress(String id);
  Future<void> deleteAddress(String id);
}

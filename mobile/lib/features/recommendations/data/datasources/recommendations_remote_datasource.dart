abstract interface class RecommendationsRemoteDataSource {
  Future<Map<String, dynamic>> getServices({required int limit});
}

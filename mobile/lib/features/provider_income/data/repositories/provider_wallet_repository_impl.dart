import '../../domain/entities/topup_response_entity.dart';
import '../../domain/entities/wallet_entity.dart';
import '../../domain/entities/wallet_transaction_entity.dart';
import '../../domain/repositories/provider_wallet_repository.dart';
import '../datasources/provider_wallet_remote_datasource.dart';

class ProviderWalletRepositoryImpl implements ProviderWalletRepository {
  final ProviderWalletRemoteDataSource _remoteDataSource;

  ProviderWalletRepositoryImpl(this._remoteDataSource);

  @override
  Future<WalletEntity> getWalletBalance() async {
    final data = await _remoteDataSource.getWalletBalance();
    return WalletEntity.fromJson(data);
  }

  @override
  Future<List<WalletTransactionEntity>> getTransactions({
    int limit = 50,
    int offset = 0,
  }) async {
    final dataList = await _remoteDataSource.getTransactions(
      limit: limit,
      offset: offset,
    );
    return dataList
        .map((json) => WalletTransactionEntity.fromJson(json as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<TopUpResponseEntity> createMomoTopUp(double amount, {String? redirectUrl}) async {
    final data = await _remoteDataSource.createMomoTopUp(amount, redirectUrl: redirectUrl);
    return TopUpResponseEntity.fromJson(data);
  }

  @override
  Future<TopUpResponseEntity> createSepayTopUp(double amount) async {
    final data = await _remoteDataSource.createSepayTopUp(amount);
    return TopUpResponseEntity.fromJson(data);
  }

  @override
  Future<TopUpResponseEntity> getTopUpDetail(String id) async {
    final data = await _remoteDataSource.getTopUpDetail(id);
    return TopUpResponseEntity.fromJson(data);
  }
}

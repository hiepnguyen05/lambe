import '../entities/topup_response_entity.dart';
import '../entities/wallet_entity.dart';
import '../entities/wallet_transaction_entity.dart';

abstract class ProviderWalletRepository {
  Future<WalletEntity> getWalletBalance();

  Future<List<WalletTransactionEntity>> getTransactions({int limit = 50});

  /// Tạo yêu cầu nạp tiền qua MoMo
  Future<TopUpResponseEntity> createMomoTopUp(
    double amount, {
    String? redirectUrl,
  });

  /// Tạo yêu cầu nạp tiền qua SePay (VietQR / Ngân hàng)
  Future<TopUpResponseEntity> createSepayTopUp(double amount);

  /// Kiểm tra trạng thái yêu cầu nạp tiền
  Future<TopUpResponseEntity> getTopUpDetail(String id);
}

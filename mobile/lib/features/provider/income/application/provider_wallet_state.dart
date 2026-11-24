import '../domain/entities/wallet_entity.dart';
import '../domain/entities/wallet_transaction_entity.dart';

class ProviderWalletState {
  final bool isLoading;
  final String? error;
  final WalletEntity? wallet;
  final List<WalletTransactionEntity> transactions;

  const ProviderWalletState({
    this.isLoading = false,
    this.error,
    this.wallet,
    this.transactions = const [],
  });

  ProviderWalletState copyWith({
    bool? isLoading,
    String? error,
    WalletEntity? wallet,
    List<WalletTransactionEntity>? transactions,
  }) {
    return ProviderWalletState(
      isLoading: isLoading ?? this.isLoading,
      error: error, // Can be null to clear error
      wallet: wallet ?? this.wallet,
      transactions: transactions ?? this.transactions,
    );
  }
}

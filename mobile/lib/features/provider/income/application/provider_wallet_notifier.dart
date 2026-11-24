import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/topup_response_entity.dart';
import '../domain/repositories/provider_wallet_repository.dart';
import './provider_wallet_state.dart';

class ProviderWalletNotifier extends StateNotifier<ProviderWalletState> {
  final ProviderWalletRepository _repository;

  ProviderWalletNotifier(this._repository)
    : super(const ProviderWalletState()) {
    loadWalletData();
  }

  Future<void> loadWalletData() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final responses = await Future.wait([
        _repository.getWalletBalance(),
        _repository.getTransactions(limit: 10),
      ]);

      final wallet = responses[0] as dynamic;
      final transactions = responses[1] as dynamic;

      state = state.copyWith(
        isLoading: false,
        wallet: wallet,
        transactions: transactions,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Không thể tải dữ liệu ví. Lỗi: $e',
      );
    }
  }

  Future<TopUpResponseEntity?> createMomoTopUp(double amount) async {
    try {
      final topUp = await _repository.createMomoTopUp(amount);
      return topUp;
    } catch (e) {
      state = state.copyWith(error: 'Tạo mã MoMo thất bại: $e');
      return null;
    }
  }

  Future<TopUpResponseEntity?> createSepayTopUp(double amount) async {
    try {
      final topUp = await _repository.createSepayTopUp(amount);
      return topUp;
    } catch (e) {
      state = state.copyWith(error: 'Tạo giao dịch SePay thất bại: $e');
      return null;
    }
  }

  Future<TopUpResponseEntity?> checkTopUpStatus(String id) async {
    try {
      final topUp = await _repository.getTopUpDetail(id);
      return topUp;
    } catch (e) {
      return null;
    }
  }
}

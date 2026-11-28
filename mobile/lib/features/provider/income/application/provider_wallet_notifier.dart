import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/topup_response_entity.dart';
import '../domain/repositories/provider_wallet_repository.dart';
import './provider_wallet_state.dart';

class ProviderWalletNotifier extends StateNotifier<ProviderWalletState> {
  final ProviderWalletRepository _repository;

  ProviderWalletNotifier(this._repository, {bool autoLoad = true})
    : super(const ProviderWalletState()) {
    if (autoLoad) {
      loadWalletData();
    }
  }

  Future<void> loadWalletData() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final responses = await Future.wait([
        _repository.getWalletBalance(),
        _repository.getTransactions(limit: 50),
      ]);
      if (!mounted) return;

      final wallet = responses[0] as dynamic;
      final transactions = responses[1] as dynamic;

      state = state.copyWith(
        isLoading: false,
        wallet: wallet,
        transactions: transactions,
      );
    } catch (e) {
      if (!mounted) return;
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
      if (mounted) state = state.copyWith(error: 'Tạo mã MoMo thất bại: $e');
      return null;
    }
  }

  Future<TopUpResponseEntity?> createSepayTopUp(double amount) async {
    try {
      final topUp = await _repository.createSepayTopUp(amount);
      return topUp;
    } catch (e) {
      if (mounted) state = state.copyWith(error: 'Tạo giao dịch SePay thất bại: $e');
      return null;
    }
  }

  Future<TopUpResponseEntity?> checkTopUpStatus(String id) async {
    try {
      final topUp = await _repository.getTopUpDetail(id);
      if (mounted && state.error != null) {
        state = state.copyWith(error: null);
      }
      return topUp;
    } catch (e) {
      if (mounted) {
        state = state.copyWith(
          error: e.toString().replaceFirst('Exception: ', ''),
        );
      }
      return null;
    }
  }
}

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/datasources/provider_vouchers_remote_datasource.dart';
import '../domain/entities/provider_voucher_entity.dart';

class ProviderVouchersState {
  final List<ProviderVoucherEntity> vouchers;
  final bool isLoading;
  final String? errorMessage;
  final bool isSubmitting;

  const ProviderVouchersState({
    this.vouchers = const [],
    this.isLoading = false,
    this.errorMessage,
    this.isSubmitting = false,
  });

  ProviderVouchersState copyWith({
    List<ProviderVoucherEntity>? vouchers,
    bool? isLoading,
    String? errorMessage,
    bool? isSubmitting,
  }) {
    return ProviderVouchersState(
      vouchers: vouchers ?? this.vouchers,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      isSubmitting: isSubmitting ?? this.isSubmitting,
    );
  }
}

class ProviderVouchersNotifier extends StateNotifier<ProviderVouchersState> {
  final ProviderVouchersRemoteDataSource _dataSource;

  ProviderVouchersNotifier(this._dataSource)
    : super(const ProviderVouchersState()) {
    loadVouchers();
  }

  Future<void> loadVouchers({bool silent = false}) async {
    if (!silent) {
      state = state.copyWith(isLoading: true, errorMessage: null);
    }
    try {
      final list = await _dataSource.getProviderVouchers();
      if (!mounted) return;
      state = state.copyWith(
        vouchers: list,
        isLoading: false,
        errorMessage: null,
      );
    } catch (e) {
      if (!mounted) return;
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<bool> createVoucher({
    required String code,
    required String discountType,
    required int value,
    int? maxDiscountAmount,
    required int minOrderAmount,
    required DateTime startsAt,
    required DateTime endsAt,
    required int usageLimit,
    int perCustomerLimit = 1,
    String? serviceId,
  }) async {
    state = state.copyWith(isSubmitting: true, errorMessage: null);
    try {
      final payload = {
        'code': code.trim().toUpperCase(),
        'discountType': discountType,
        'value': value,
        if (maxDiscountAmount != null && maxDiscountAmount > 0)
          'maxDiscountAmount': maxDiscountAmount,
        'minOrderAmount': minOrderAmount,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'endsAt': endsAt.toUtc().toIso8601String(),
        'usageLimit': usageLimit,
        'perCustomerLimit': perCustomerLimit,
        if (serviceId != null && serviceId.isNotEmpty) 'serviceId': serviceId,
      };

      await _dataSource.createProviderVoucher(payload);
      if (!mounted) return true;
      state = state.copyWith(isSubmitting: false);
      await loadVouchers(silent: true);
      return true;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }

  Future<bool> disableVoucher(String voucherId) async {
    try {
      await _dataSource.disableProviderVoucher(voucherId);
      if (!mounted) return true;
      await loadVouchers(silent: true);
      return true;
    } catch (e) {
      if (!mounted) return false;
      state = state.copyWith(
        errorMessage: e.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }
}

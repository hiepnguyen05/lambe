import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

import '../../../di/provider_income_providers.dart';
import '../../../domain/entities/topup_response_entity.dart';

/// Shared foreground-aware exponential backoff polling for pending wallet top-ups.
mixin TopUpPollingMixin<T extends ConsumerStatefulWidget>
    on ConsumerState<T>, WidgetsBindingObserver {
  static const _pollIntervals = [
    Duration(seconds: 3),
    Duration(seconds: 5),
    Duration(seconds: 10),
  ];

  late TopUpResponseEntity currentTopUp;
  Timer? _pollingTimer;
  bool isCheckingTopUp = false;
  bool _isPolling = false;
  bool _isForeground = true;
  int _pollIntervalIndex = 0;

  void initTopUpPolling(TopUpResponseEntity initialTopUp) {
    WidgetsBinding.instance.addObserver(this);
    currentTopUp = initialTopUp;
    _schedulePoll();
  }

  void disposeTopUpPolling() {
    _pollingTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final foreground = state == AppLifecycleState.resumed;
    if (_isForeground == foreground) return;
    _isForeground = foreground;
    _pollingTimer?.cancel();
    if (foreground && currentTopUp.isPending) {
      _pollIntervalIndex = 0;
      unawaited(_refreshAfterResume());
    }
  }

  Future<void> _refreshAfterResume() async {
    await checkTopUpStatus(isAuto: true);
    _schedulePoll();
  }

  void _schedulePoll() {
    _pollingTimer?.cancel();
    if (!mounted || !_isForeground || !currentTopUp.isPending) return;
    _pollingTimer = Timer(_pollIntervals[_pollIntervalIndex], () async {
      if (!mounted || !_isForeground || !currentTopUp.isPending) return;
      if (_isPolling || isCheckingTopUp) {
        _schedulePoll();
        return;
      }
      _isPolling = true;
      try {
        await checkTopUpStatus(isAuto: true);
      } finally {
        _isPolling = false;
      }
      if (_pollIntervalIndex < _pollIntervals.length - 1) {
        _pollIntervalIndex++;
      }
      _schedulePoll();
    });
  }

  Future<void> checkTopUpStatus({bool isAuto = false}) async {
    if (!isAuto && mounted) {
      setState(() {
        isCheckingTopUp = true;
      });
    }

    try {
      final updated = await ref
          .read(providerWalletNotifierProvider.notifier)
          .checkTopUpStatus(currentTopUp.id);

      if (!mounted) return;
      if (updated == null) {
        if (!isAuto) {
          final errorMessage =
              ref.read(providerWalletNotifierProvider).error ??
              'Không thể kiểm tra trạng thái nạp tiền. Vui lòng thử lại.';
          AppDialog.error(context, message: errorMessage);
        }
        return;
      }

      setState(() {
        currentTopUp = updated;
      });

      if (updated.isSucceeded) {
        _pollingTimer?.cancel();
        ref.read(providerWalletNotifierProvider.notifier).loadWalletData();
      } else if (updated.isFailed || updated.isExpired) {
        _pollingTimer?.cancel();
      }
    } finally {
      if (mounted && !isAuto) {
        setState(() {
          isCheckingTopUp = false;
        });
      }
    }
  }
}


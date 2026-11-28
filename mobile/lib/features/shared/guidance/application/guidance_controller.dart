import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../data/guidance_repository.dart';
import '../domain/guidance_progress.dart';

final guidanceRepositoryProvider = Provider(
  (ref) => GuidanceRepository(
    ref.watch(dioProvider),
    ref.watch(flutterSecureStorageProvider),
  ),
);
final guidanceProgressProvider =
    AsyncNotifierProvider<GuidanceController, Map<String, GuidanceProgress>>(
      GuidanceController.new,
    );
final guidanceBusyProvider = StateProvider<bool>((ref) => false);

class GuidanceController extends AsyncNotifier<Map<String, GuidanceProgress>> {
  Future<void> _writes = Future.value();
  Future<void> _localWrites = Future.value();
  int _generation = 0;
  CancelToken? _cancel;
  Timer? _retry;
  Future<void> flush() => _writes;

  Future<void> _cache(
    GuidanceRepository repository,
    String userId,
    Map<String, GuidanceProgress> records,
    int generation,
  ) {
    _localWrites = _localWrites.catchError((Object _) {}).then((_) async {
      if (generation == _generation) await repository.cache(userId, records);
    });
    return _localWrites.catchError((Object _) {});
  }

  void _retrySync(int generation) {
    _retry?.cancel();
    _retry = Timer(const Duration(seconds: 30), () {
      if (generation == _generation) ref.invalidateSelf();
    });
  }

  @override
  Future<Map<String, GuidanceProgress>> build() async {
    final userId = ref.watch(
      authNotifierProvider.select((a) => a.valueOrNull?.id),
    );
    final repository = ref.watch(guidanceRepositoryProvider);
    final generation = ++_generation;
    final cancel = CancelToken();
    _cancel = cancel;
    ref.onDispose(() {
      cancel.cancel();
      _retry?.cancel();
      if (generation == _generation) _generation++;
    });
    if (userId == null) return {};
    final records = await repository.load(userId, cancel);
    if (generation != _generation) return {};
    if (records.values.any((p) => p.pendingSync)) _retrySync(generation);
    return records;
  }

  void save(String tourId, int version, int stepIndex, String status) {
    final userId = ref.read(authNotifierProvider).valueOrNull?.id;
    if (userId == null) return;
    final repository = ref.read(guidanceRepositoryProvider);
    final progress = GuidanceProgress(
      tourId: tourId,
      version: version,
      stepIndex: stepIndex,
      status: status,
      pendingSync: true,
    );
    final records = {...?state.valueOrNull, tourId: progress};
    state = AsyncData(records);
    final generation = _generation;
    final cancel = _cancel;
    // Persist each step independently of an earlier slow network request.
    final cached = _cache(repository, userId, records, generation);
    _writes = _writes.catchError((Object _) {}).then((_) async {
      if (generation != _generation) return;
      await cached;
      try {
        if (generation != _generation) return;
        final acknowledged = await repository.saveRemote(progress, cancel);
        if (generation == _generation &&
            identical(state.valueOrNull?[tourId], progress)) {
          final synced = {...?state.valueOrNull, tourId: acknowledged};
          state = AsyncData(synced);
          await _cache(repository, userId, synced, generation);
        }
      } catch (_) {
        if (generation == _generation) _retrySync(generation);
      }
    });
  }
}

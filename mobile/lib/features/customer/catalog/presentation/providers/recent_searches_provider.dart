import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../../data/repositories/recent_searches_store.dart';

const List<String> kDefaultRecentSearches = [];

class RecentSearchesNotifier extends StateNotifier<List<String>> {
  final RecentSearchesStore? store;
  final String? userId;
  int _revision = 0;
  Future<void> _writeQueue = Future.value();
  RecentSearchesNotifier({this.store, this.userId}) : super(kDefaultRecentSearches) {
    _restore();
  }

  Future<void> _restore() async {
    final history = store;
    final account = userId;
    if (history == null || account == null) return;
    final revision = _revision;
    try {
      final saved = await history.read(account);
      if (mounted && revision == _revision) state = saved;
    } catch (_) {
      // Corrupt or unavailable local history must not block service search.
    }
  }

  Future<void> get persisted => _writeQueue;

  void _save() {
    _revision++;
    final history = store;
    final account = userId;
    if (history == null || account == null) return;
    final snapshot = List<String>.from(state);
    _writeQueue = _writeQueue
        .then((_) => history.write(account, snapshot))
        .catchError((Object _) {
          debugPrint('Recent search history could not be saved.');
        });
  }

  void addSearch(String query) {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    final updated = List<String>.from(state);
    updated.removeWhere((item) => item.toLowerCase() == trimmed.toLowerCase());
    updated.insert(0, trimmed);

    if (updated.length > 10) {
      state = updated.sublist(0, 10);
    } else {
      state = updated;
    }
    _save();
  }

  void removeSearch(String query) {
    final updated = List<String>.from(state);
    updated.removeWhere(
      (item) => item.toLowerCase() == query.trim().toLowerCase(),
    );
    state = updated;
    _save();
  }

  void clearAll() {
    state = const [];
    _save();
  }
}

final recentSearchesProvider =
    StateNotifierProvider<RecentSearchesNotifier, List<String>>((ref) {
      final userId = ref.watch(
        authNotifierProvider.select((state) => state.valueOrNull?.id),
      );
      return RecentSearchesNotifier(
        store: const RecentSearchesStore(
          FlutterSecureStorage(
            aOptions: AndroidOptions(encryptedSharedPreferences: true),
          ),
        ),
        userId: userId,
      );
    });

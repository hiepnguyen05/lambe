import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class RecentSearchesStore {
  final FlutterSecureStorage storage;
  const RecentSearchesStore(this.storage);

  Future<List<String>> read(String userId) async {
    final saved = await storage.read(key: 'recent_searches_$userId');
    if (saved == null) return [];
    final decoded = jsonDecode(saved);
    if (decoded is! List) return [];
    return decoded
        .whereType<String>()
        .where((query) => query.trim().isNotEmpty)
        .take(10)
        .toList();
  }

  Future<void> write(String userId, List<String> queries) => storage.write(
    key: 'recent_searches_$userId',
    value: jsonEncode(queries.take(10).toList()),
  );
}

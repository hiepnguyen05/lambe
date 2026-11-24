import 'dart:async';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/customer/catalog/data/repositories/recent_searches_store.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/recent_searches_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  test('real searches persist and do not appear for another account', () async {
    const store = RecentSearchesStore(FlutterSecureStorage());
    final first = RecentSearchesNotifier(store: store, userId: 'a');
    first.addSearch('Cắt tóc');
    await first.persisted;
    first.dispose();
    final restored = RecentSearchesNotifier(store: store, userId: 'a');
    final other = RecentSearchesNotifier(store: store, userId: 'b');
    addTearDown(restored.dispose);
    addTearDown(other.dispose);
    await Future<void>.delayed(Duration.zero);
    expect(restored.state, ['Cắt tóc']);
    expect(other.state, isEmpty);
  });

  test('deletes and clear persist in order', () async {
    const store = RecentSearchesStore(FlutterSecureStorage());
    final notifier = RecentSearchesNotifier(store: store, userId: 'a');
    addTearDown(notifier.dispose);
    notifier.addSearch('Tóc');
    notifier.addSearch('Nail');
    notifier.removeSearch('Tóc');
    notifier.clearAll();
    await notifier.persisted;
    expect(await store.read('a'), isEmpty);
  });

  test('delayed restore cannot overwrite a newly typed search', () async {
    final store = _DelayedStore();
    final notifier = RecentSearchesNotifier(store: store, userId: 'a');
    addTearDown(notifier.dispose);
    notifier.addSearch('Mới');
    store.pending.complete(['Cũ']);
    await Future<void>.delayed(Duration.zero);
    expect(notifier.state, ['Mới']);
  });
}

class _DelayedStore extends RecentSearchesStore {
  final pending = Completer<List<String>>();
  _DelayedStore() : super(const FlutterSecureStorage());
  @override
  Future<List<String>> read(String userId) => pending.future;
  @override
  Future<void> write(String userId, List<String> queries) async {}
}

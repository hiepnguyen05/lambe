import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/services/di/provider_services_providers.dart';
import 'package:mobile/features/provider/services/presentation/widgets/service_document_viewer.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';

import 'support/service_fakes.dart';

class _Auth implements AuthRepository {
  @override
  Future<UserEntity?> getCurrentUser() async =>
      const UserEntity(id: 'owner', roles: ['PROVIDER']);
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Images extends FakeServiceMediaRepository {
  int views = 0;
  @override
  Future<Uint8List> image(
    String id,
    String documentId,
    CancelToken cancel,
  ) async {
    views++;
    return base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0j8AAAAASUVORK5CYII=',
    );
  }
}

void main() {
  testWidgets(
    'private preview drops its image in background and fetches again only on explicit reload',
    (tester) async {
      final images = _Images();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authRepositoryProvider.overrideWithValue(_Auth()),
            serviceChangeMediaRepositoryProvider.overrideWithValue(images),
          ],
          child: MaterialApp(
            home: Consumer(
              builder: (context, ref, _) {
                ref.watch(authNotifierProvider);
                return Scaffold(
                  body: TextButton(
                    onPressed: () =>
                        showServiceDocument(context, 'request', 'doc'),
                    child: const Text('Xem ảnh'),
                  ),
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xem ảnh'));
      await tester.pumpAndSettle();
      expect(images.views, 1);
      expect(find.byType(Image), findsOneWidget);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      expect(find.byType(Image), findsNothing);
      expect(images.views, 1);
      await tester.tap(find.text('Tải lại ảnh'));
      await tester.pumpAndSettle();
      expect(images.views, 2);
      await tester.tap(find.text('Đóng'));
      await tester.pumpAndSettle();
      expect(find.byType(Image), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}

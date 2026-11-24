import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';
import 'package:mobile/features/shared/auth/domain/repositories/auth_repository.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/widgets/feed_notices_sheet.dart';

class _Auth extends Fake implements AuthRepository {
  @override
  Future<UserEntity?> getCurrentUser() async =>
      UserEntity(id: 'viewer', roles: const ['CUSTOMER']);
}

class _Adapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    expect(options.path, '/me/feed/notices');
    return ResponseBody.fromString(
      jsonEncode({
        'success': true,
        'data': {
          'data': [
            {
              'id': 'notice',
              'postId': 'post',
              'detail': 'Báo cáo của bạn đã được xem xét.',
              'managed': false,
              'readAt': null,
            },
          ],
        },
      }),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  testWidgets(
    'Feed notices render the server result without dismissing on initial authentication load',
    (tester) async {
      final dio = Dio()..httpClientAdapter = _Adapter();
      addTearDown(dio.close);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            dioProvider.overrideWithValue(dio),
            authRepositoryProvider.overrideWithValue(_Auth()),
          ],
          child: const MaterialApp(home: Scaffold(body: FeedNoticesSheet())),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Báo cáo của bạn đã được xem xét.'), findsOneWidget);
      expect(find.text('Chưa đọc'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}

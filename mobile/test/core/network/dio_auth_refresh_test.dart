import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

void main() {
  group('Dio Auth & Auto-Refresh Interceptor', () {
    test('replays streamed multipart after 401 with a fresh FormData and the same file', () async {
      final storage = _MemoryStorage()
        ..token = 'old-token'
        ..refreshToken = 'refresh-token';
      final refresh = Dio(BaseOptions(baseUrl: ApiEndpoints.baseUrl));
      refresh.httpClientAdapter = _MockAdapter(
        (_) async => ResponseBody.fromString(
          jsonEncode({
            'success': true,
            'data': {'accessToken': 'new-token', 'refreshToken': 'new-refresh'},
          }),
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        ),
      );
      final container = ProviderContainer(
        overrides: [
          secureStorageProvider.overrideWithValue(storage),
          refreshDioProvider.overrideWithValue(refresh),
        ],
      );
      addTearDown(container.dispose);
      final dio = container.read(dioProvider),
          bodies = <String>[],
          tokens = <Object?>[];
      dio.httpClientAdapter = _MultipartAdapter((options, body) async {
        bodies.add(body);
        tokens.add(options.headers['Authorization']);
        return ResponseBody.fromString(
          jsonEncode({
            'success': bodies.length > 1,
            'data': {'id': 'post'},
          }),
          bodies.length == 1 ? 401 : 201,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      });
      final response = await dio.post(
        '/me/feed/posts',
        data: FormData.fromMap({
          'caption': 'Tác phẩm',
          'files': MultipartFile.fromStream(
            () => Stream.value(Uint8List.fromList('file-body'.codeUnits)),
            9,
            filename: 'feed.jpg',
          ),
        }),
      );
      expect(response.statusCode, 201);
      expect(bodies, hasLength(2));
      expect(
        bodies.every((v) => v.contains('file-body') && v.contains('feed.jpg')),
        isTrue,
      );
      expect(tokens, ['Bearer old-token', 'Bearer new-token']);
    });
    test(
      'attaches Bearer token from secureStorage to request headers',
      () async {
        final storage = _MemoryStorage()..token = 'existing-access-token';
        final container = ProviderContainer(
          overrides: [secureStorageProvider.overrideWithValue(storage)],
        );
        addTearDown(container.dispose);

        final dio = container.read(dioProvider);
        RequestOptions? interceptedOptions;

        dio.httpClientAdapter = _MockAdapter((options) async {
          interceptedOptions = options;
          return ResponseBody.fromString(
            jsonEncode({'success': true, 'data': {}}),
            200,
            headers: {
              Headers.contentTypeHeader: [Headers.jsonContentType],
            },
          );
        });

        await dio.get('/test-endpoint');

        expect(
          interceptedOptions?.headers['Authorization'],
          'Bearer existing-access-token',
        );
      },
    );

    test(
      'retries failed request when receiving 401 and refresh succeeds',
      () async {
        final storage = _MemoryStorage()
          ..token = 'expired-access-token'
          ..refreshToken = 'valid-refresh-token';

        final mockRefreshDio = Dio(BaseOptions(baseUrl: ApiEndpoints.baseUrl));
        int refreshCallCount = 0;
        mockRefreshDio.httpClientAdapter = _MockAdapter((options) async {
          refreshCallCount++;
          expect(options.path, ApiEndpoints.refreshToken);
          return ResponseBody.fromString(
            jsonEncode({
              'success': true,
              'data': {
                'accessToken': 'new-access-token',
                'refreshToken': 'new-refresh-token',
              },
            }),
            200,
            headers: {
              Headers.contentTypeHeader: [Headers.jsonContentType],
            },
          );
        });

        final container = ProviderContainer(
          overrides: [
            secureStorageProvider.overrideWithValue(storage),
            refreshDioProvider.overrideWithValue(mockRefreshDio),
          ],
        );
        addTearDown(container.dispose);

        final dio = container.read(dioProvider);
        int callCount = 0;
        final requestedAuthHeaders = <String?>[];

        dio.httpClientAdapter = _MockAdapter((options) async {
          callCount++;
          requestedAuthHeaders.add(options.headers['Authorization'] as String?);
          if (callCount == 1) {
            return ResponseBody.fromString(
              jsonEncode({'message': 'Unauthorized'}),
              401,
              headers: {
                Headers.contentTypeHeader: [Headers.jsonContentType],
              },
            );
          }
          return ResponseBody.fromString(
            jsonEncode({
              'success': true,
              'data': {'result': 'ok'},
            }),
            200,
            headers: {
              Headers.contentTypeHeader: [Headers.jsonContentType],
            },
          );
        });

        final response = await dio.get<Map<String, dynamic>>(
          '/protected-endpoint',
        );

        expect(response.statusCode, 200);
        expect(response.data?['data']['result'], 'ok');
        expect(callCount, 2);
        expect(refreshCallCount, 1);
        expect(storage.token, 'new-access-token');
        expect(storage.refreshToken, 'new-refresh-token');
        expect(requestedAuthHeaders, [
          'Bearer expired-access-token',
          'Bearer new-access-token',
        ]);
      },
    );

    test('deduplicates concurrent 401 requests to execute exactly ONE refresh call', () async {
      final storage = _MemoryStorage()
        ..token = 'expired-token'
        ..refreshToken = 'valid-refresh-token';

      int refreshCallCount = 0;
      final mockRefreshDio = Dio(BaseOptions(baseUrl: ApiEndpoints.baseUrl));
      mockRefreshDio.httpClientAdapter = _MockAdapter((options) async {
        refreshCallCount++;
        await Future<void>.delayed(const Duration(milliseconds: 20));
        return ResponseBody.fromString(
          jsonEncode({
            'success': true,
            'data': {
              'accessToken': 'shared-new-access-token',
              'refreshToken': 'shared-new-refresh-token',
            },
          }),
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      });

      final container = ProviderContainer(
        overrides: [
          secureStorageProvider.overrideWithValue(storage),
          refreshDioProvider.overrideWithValue(mockRefreshDio),
        ],
      );
      addTearDown(container.dispose);

      final dio = container.read(dioProvider);
      final initialAttemptCounts = <String, int>{};

      dio.httpClientAdapter = _MockAdapter((options) async {
        final path = options.path;
        final currentAttempts = initialAttemptCounts[path] ?? 0;
        initialAttemptCounts[path] = currentAttempts + 1;

        if (currentAttempts == 0) {
          return ResponseBody.fromString(
            jsonEncode({'message': 'Unauthorized'}),
            401,
            headers: {
              Headers.contentTypeHeader: [Headers.jsonContentType],
            },
          );
        }
        return ResponseBody.fromString(
          jsonEncode({
            'success': true,
            'data': {'endpoint': path},
          }),
          200,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      });

      // Gửi đồng thời 3 API calls khi token đã hết hạn
      final results = await Future.wait<Response<Map<String, dynamic>>>([
        dio.get<Map<String, dynamic>>('/orders'),
        dio.get<Map<String, dynamic>>('/notifications'),
        dio.get<Map<String, dynamic>>('/profile'),
      ]);

      expect(results.length, 3);
      for (final res in results) {
        expect(res.statusCode, 200);
      }

      // Đảm bảo refresh chỉ được gọi duy nhất 1 lần
      expect(refreshCallCount, 1);
      expect(storage.token, 'shared-new-access-token');
      expect(storage.refreshToken, 'shared-new-refresh-token');
    });

    test('clears storage when refresh fails', () async {
      final storage = _MemoryStorage()
        ..token = 'expired-token'
        ..refreshToken = 'invalid-refresh-token';

      final mockRefreshDio = Dio(BaseOptions(baseUrl: ApiEndpoints.baseUrl));
      mockRefreshDio.httpClientAdapter = _MockAdapter((options) async {
        return ResponseBody.fromString(
          jsonEncode({'message': 'Invalid refresh token'}),
          401,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      });

      final container = ProviderContainer(
        overrides: [
          secureStorageProvider.overrideWithValue(storage),
          refreshDioProvider.overrideWithValue(mockRefreshDio),
        ],
      );
      addTearDown(container.dispose);

      final dio = container.read(dioProvider);
      dio.httpClientAdapter = _MockAdapter((options) async {
        return ResponseBody.fromString(
          jsonEncode({'message': 'Unauthorized'}),
          401,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      });

      try {
        await dio.get('/test-endpoint');
      } catch (_) {}

      expect(storage.clearCount, 1);
      expect(storage.token, isNull);
      expect(storage.refreshToken, isNull);
    });

    test('preserves storage when refresh fails due to network error', () async {
      final storage = _MemoryStorage()
        ..token = 'expired-token'
        ..refreshToken = 'valid-refresh-token';

      final mockRefreshDio = Dio(BaseOptions(baseUrl: ApiEndpoints.baseUrl));
      mockRefreshDio.httpClientAdapter = _MockAdapter((options) async {
        throw DioException(
          requestOptions: options,
          type: DioExceptionType.connectionTimeout,
          error: 'Connection timed out',
        );
      });

      final container = ProviderContainer(
        overrides: [
          secureStorageProvider.overrideWithValue(storage),
          refreshDioProvider.overrideWithValue(mockRefreshDio),
        ],
      );
      addTearDown(container.dispose);

      final dio = container.read(dioProvider);
      dio.httpClientAdapter = _MockAdapter((options) async {
        return ResponseBody.fromString(
          jsonEncode({'message': 'Unauthorized'}),
          401,
          headers: {
            Headers.contentTypeHeader: [Headers.jsonContentType],
          },
        );
      });

      try {
        await dio.get('/test-endpoint');
      } catch (_) {}

      expect(storage.clearCount, 0);
      expect(storage.token, 'expired-token');
      expect(storage.refreshToken, 'valid-refresh-token');
    });
  });
}

class _MockAdapter implements HttpClientAdapter {
  final Future<ResponseBody> Function(RequestOptions options) handler;
  _MockAdapter(this.handler);

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => handler(options);

  @override
  void close({bool force = false}) {}
}

class _MultipartAdapter implements HttpClientAdapter {
  final Future<ResponseBody> Function(RequestOptions, String) handler;
  _MultipartAdapter(this.handler);
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    final bytes = await stream!.fold<List<int>>(
      [],
      (all, chunk) => all..addAll(chunk),
    );
    return handler(options, utf8.decode(bytes));
  }

  @override
  void close({bool force = false}) {}
}

class _MemoryStorage implements SecureStorageService {
  final _appModes = <String, String>{};

  @override
  Future<String?> getAppMode(String userId) async => _appModes[userId];

  @override
  Future<void> saveAppMode(String userId, String mode) async {
    _appModes[userId] = mode;
  }

  @override
  Future<void> deleteAppMode(String userId) async {
    _appModes.remove(userId);
  }

  String? token;
  String? refreshToken;
  int clearCount = 0;

  @override
  Future<String> getInstallationId() async => 'test-installation-id';

  @override
  Future<bool> wasPushPermissionExplained() async => false;

  @override
  Future<void> markPushPermissionExplained() async {}

  @override
  Future<void> saveAccessToken(String token) async => this.token = token;

  @override
  Future<String?> getAccessToken() async => token;

  @override
  Future<void> saveRefreshToken(String token) async => refreshToken = token;

  @override
  Future<String?> getRefreshToken() async => refreshToken;

  @override
  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    token = accessToken;
    this.refreshToken = refreshToken;
  }

  @override
  Future<void> saveUserSession({
    required String userId,
    required String phone,
    List<String>? roles,
  }) async {
    if (roles != null) await saveUserRoles(roles);
  }

  List<String> _roles = [];

  @override
  Future<void> saveUserRoles(List<String> roles) async {
    _roles = List.from(roles);
  }

  @override
  Future<List<String>> getUserRoles() async => _roles;

  @override
  Future<String?> getUserId() async => null;

  @override
  Future<String?> getPhone() async => null;

  @override
  Future<void> clearAll() async {
    token = null;
    refreshToken = null;
    _roles = [];
    _appModes.clear();
    clearCount++;
  }
}

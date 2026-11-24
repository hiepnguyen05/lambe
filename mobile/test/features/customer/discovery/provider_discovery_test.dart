import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/error/app_failure.dart';
import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/widgets/app_specialist_card.dart';
import 'package:mobile/features/customer/booking/domain/entities/booking_draft_entity.dart';
import 'package:mobile/features/customer/booking/domain/entities/booking_provider_candidate_entity.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/services_list_provider.dart';
import 'package:mobile/features/customer/discovery/data/provider_discovery_repository.dart';
import 'package:mobile/features/customer/discovery/domain/provider_search_request.dart';
import 'package:mobile/features/customer/discovery/presentation/nearby_providers_section.dart';

const _service = ServiceItemEntity(
  id: 'service-hair',
  code: 'HAIR',
  name: 'Cắt tóc',
  slug: 'cat-toc',
  minPriceAmount: 100000,
  maxPriceAmount: 200000,
  category: ServiceCategorySummaryEntity(
    id: 'hair',
    code: 'HAIR',
    name: 'Tóc',
    slug: 'toc',
  ),
);

void main() {
  test('SCHEDULED sends UTC time and the selected catalog service', () async {
    final dio = _DiscoveryDio();
    final at = DateTime.parse('2026-11-10T18:00:00+07:00');
    await ProviderDiscoveryRepository(dio).search(
      ProviderSearchRequest(
        serviceId: 'chosen-service',
        bookingType: BookingType.scheduled,
        scheduledAt: at,
        customerAddressId: 'my-address',
      ),
    );
    expect(dio.body!['scheduledAt'], '2026-11-10T11:00:00.000Z');
    expect(dio.body!['serviceId'], 'chosen-service');
    expect(dio.body!['customerAddressId'], 'my-address');
    expect(dio.body!.containsKey('latitude'), isFalse);
    expect(dio.path, '/discovery/providers/search');
  });

  test('ASAP omits a stale scheduledAt and sends real coordinates', () async {
    final dio = _DiscoveryDio();
    await ProviderDiscoveryRepository(dio).search(
      ProviderSearchRequest(
        serviceId: 'chosen-service',
        scheduledAt: DateTime.utc(2026, 11, 10),
        latitude: 21.0285,
        longitude: 105.8542,
      ),
    );
    expect(dio.body!['bookingType'], 'ASAP');
    expect(dio.body!.containsKey('scheduledAt'), isFalse);
    expect(dio.body!['latitude'], 21.0285);
    expect(dio.body!['longitude'], 105.8542);
  });

  test('incomplete or invalid input never calls discovery', () async {
    final dio = _DiscoveryDio();
    final repo = ProviderDiscoveryRepository(dio);
    for (final request in [
      const ProviderSearchRequest(
        serviceId: 's',
        bookingType: BookingType.scheduled,
        customerAddressId: 'a',
      ),
      const ProviderSearchRequest(serviceId: 's'),
      const ProviderSearchRequest(serviceId: 's', latitude: 21),
      const ProviderSearchRequest(serviceId: 's', latitude: 91, longitude: 105),
      ProviderSearchRequest(
        serviceId: 's',
        latitude: double.nan,
        longitude: 105,
      ),
      const ProviderSearchRequest(serviceId: '', customerAddressId: 'a'),
    ]) {
      await expectLater(
        repo.search(request),
        throwsA(isA<ValidationFailure>()),
      );
    }
    expect(dio.calls, 0);
  });

  test('real empty response remains empty', () async {
    expect(
      await ProviderDiscoveryRepository(_DiscoveryDio()).search(
        const ProviderSearchRequest(serviceId: 's', customerAddressId: 'a'),
      ),
      isEmpty,
    );
  });

  test(
    'network and validation failures are not empty search results',
    () async {
      final dio = _DiscoveryDio()..networkError = true;
      final repo = ProviderDiscoveryRepository(dio);
      const request = ProviderSearchRequest(
        serviceId: 's',
        customerAddressId: 'a',
      );
      await expectLater(repo.search(request), throwsA(isA<NetworkFailure>()));
      dio
        ..networkError = false
        ..status = 400;
      await expectLater(
        repo.search(request),
        throwsA(isA<ValidationFailure>()),
      );
    },
  );

  test('malformed response is a visible server failure', () async {
    final dio = _DiscoveryDio()
      ..rows = [
        {
          'id': 'p',
          'service': {'id': 'ps'},
        },
      ];
    await expectLater(
      ProviderDiscoveryRepository(dio).search(
        const ProviderSearchRequest(serviceId: 's', customerAddressId: 'a'),
      ),
      throwsA(isA<ServerFailure>()),
    );
  });

  test('candidate has no generated rating, badge or experience', () {
    final candidate = BookingProviderCandidateEntity.fromJson(_candidate());
    expect(candidate.rating, isNull);
    expect(candidate.reviewCount, 0);
    expect(candidate.badge, isEmpty);
    expect(candidate.experienceYears, 0);
  });

  test('member reviewSummary is used instead of organization rating', () {
    final candidate = BookingProviderCandidateEntity.fromJson({
      ..._candidate(),
      'memberId': 'm1',
      'rating': 4.9,
      'reviewSummary': {'count': 0, 'averageRating': null},
    });
    expect(candidate.memberId, 'm1');
    expect(candidate.rating, isNull);
  });

  testWidgets('null rating renders an honest label', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AppSpecialistCard.fromBookingCandidate(
            candidate: BookingProviderCandidateEntity.fromJson(_candidate()),
          ),
        ),
      ),
    );
    expect(find.text('Chưa có đánh giá'), findsOneWidget);
    expect(find.text('5.0'), findsNothing);
  });

  testWidgets('catalog does not automatically select its first service', (
    tester,
  ) async {
    final dio = _DiscoveryDio();
    await _pump(tester, dio);
    expect(
      find.text('Chọn một dịch vụ để xem chuyên viên phù hợp.'),
      findsOneWidget,
    );
    expect(dio.calls, 0);
  });

  testWidgets(
    'missing GPS requests permission without searching fake coordinates',
    (tester) async {
      final dio = _DiscoveryDio();
      await _pump(tester, dio);
      await _choose(tester);
      expect(dio.calls, 0);
      expect(find.text('Lấy vị trí hiện tại'), findsOneWidget);
    },
  );

  testWidgets('saved address is used without GPS permission', (tester) async {
    final dio = _DiscoveryDio();
    await _pump(tester, dio, addressId: 'saved-address');
    await _choose(tester);
    expect(dio.body!['customerAddressId'], 'saved-address');
    expect(dio.body!['serviceId'], _service.id);
    expect(dio.body!['bookingType'], 'ASAP');
    expect(dio.body!.containsKey('latitude'), isFalse);
  });

  testWidgets('valid GPS searches the explicitly selected service', (
    tester,
  ) async {
    final dio = _DiscoveryDio();
    await _pump(
      tester,
      dio,
      location: const UserLocationModel(
        isLoaded: true,
        hasPermission: true,
        serviceEnabled: true,
        latitude: 21.0285,
        longitude: 105.8542,
      ),
    );
    await _choose(tester);
    expect(dio.body!['latitude'], 21.0285);
    expect(dio.body!['longitude'], 105.8542);
    expect(dio.body!['serviceId'], _service.id);
  });

  testWidgets(
    'GPS disabled and permission denied are not empty search results',
    (tester) async {
      final dio = _DiscoveryDio();
      await _pump(
        tester,
        dio,
        location: const UserLocationModel(isLoaded: true),
      );
      await _choose(tester);
      expect(find.text('Hãy bật GPS để tìm chuyên viên.'), findsOneWidget);
      expect(dio.calls, 0);
      await tester.pumpWidget(const SizedBox.shrink());
      await _pump(
        tester,
        dio,
        location: const UserLocationModel(
          isLoaded: true,
          serviceEnabled: true,
          hasPermission: false,
        ),
      );
      await _choose(tester);
      expect(find.textContaining('Hãy cấp quyền vị trí'), findsOneWidget);
      expect(dio.calls, 0);
    },
  );

  testWidgets('discovery failure is displayed with retry', (tester) async {
    final dio = _DiscoveryDio()..networkError = true;
    await _pump(tester, dio, addressId: 'saved-address');
    await _choose(tester);
    expect(find.textContaining('Không thể kết nối'), findsOneWidget);
    expect(find.text('Thử lại'), findsOneWidget);
    expect(
      find.textContaining('Chưa có chuyên viên phù hợp đang hoạt động'),
      findsNothing,
    );
    dio.networkError = false;
    await tester.tap(find.text('Thử lại'));
    await tester.pumpAndSettle();
    expect(dio.calls, 2);
    expect(
      find.textContaining('Chưa có chuyên viên phù hợp đang hoạt động'),
      findsOneWidget,
    );
  });
}

Map<String, dynamic> _candidate() => {
  'id': 'provider-1',
  'displayName': 'Thợ A',
  'distanceKm': 2.5,
  'available': true,
  'service': {'id': 'ps-1', 'priceAmount': 120000, 'durationMinutes': 45},
};

Future<void> _pump(
  WidgetTester tester,
  Dio dio, {
  String? addressId,
  UserLocationModel location = const UserLocationModel(),
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dioProvider.overrideWithValue(dio),
        userLocationProvider.overrideWith((ref) => _FixedLocation(location)),
        allCatalogServicesProvider.overrideWith((ref) async => [_service]),
      ],
      child: MaterialApp(
        home: Scaffold(
          body: NearbyProvidersSection(customerAddressId: addressId),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _FixedLocation extends UserLocationNotifier {
  _FixedLocation(UserLocationModel initial) {
    state = initial;
  }
}

Future<void> _choose(WidgetTester tester) async {
  await tester.tap(find.byType(DropdownButtonFormField<String>));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Cắt tóc').last);
  await tester.pumpAndSettle();
}

class _DiscoveryDio extends DioMixin implements Dio {
  int calls = 0;
  int status = 200;
  bool networkError = false;
  List<Object> rows = [];
  Map<String, dynamic>? body;
  String? path;
  @override
  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    calls++;
    this.path = path;
    body = data as Map<String, dynamic>;
    final request = RequestOptions(path: path);
    if (networkError) {
      throw DioException(
        requestOptions: request,
        type: DioExceptionType.connectionError,
      );
    }
    if (status != 200) {
      throw DioException(
        requestOptions: request,
        type: DioExceptionType.badResponse,
        response: Response(
          requestOptions: request,
          statusCode: status,
          data: {'message': 'Invalid request'},
        ),
      );
    }
    return Response<T>(
      requestOptions: request,
      data: {'success': true, 'data': rows} as T,
    );
  }
}

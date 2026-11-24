import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/shared/address/domain/entities/address_entity.dart';
import 'package:mobile/features/customer/booking/domain/entities/booking_provider_candidate_entity.dart';
import 'package:mobile/features/customer/booking/presentation/providers/booking_candidates_provider.dart';
import 'package:mobile/features/customer/booking/presentation/providers/booking_draft_provider.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';

void main() {
  const service = ServiceItemEntity(
    id: 'service-1',
    code: 'HAIR',
    name: 'Cắt tóc',
    slug: 'cat-toc',
    minPriceAmount: 100000,
    maxPriceAmount: 200000,
    currencyCode: 'VND',
    defaultDurationMinutes: 45,
    category: ServiceCategorySummaryEntity(
      id: 'category-1',
      code: 'HAIR',
      name: 'Tóc',
      slug: 'toc',
    ),
  );

  test('requires a booking address before searching providers', () async {
    final dio = _SearchDio();
    final container = ProviderContainer(
      overrides: [dioProvider.overrideWithValue(dio)],
    );
    addTearDown(container.dispose);
    container.read(bookingDraftProvider.notifier).initialize(service: service);

    await expectLater(
      container.read(bookingCandidatesProvider.future),
      throwsA(isA<StateError>()),
    );
    expect(dio.requestBody, isNull);
  });

  test('search uses the saved booking address', () async {
    final dio = _SearchDio();
    final container = ProviderContainer(
      overrides: [dioProvider.overrideWithValue(dio)],
    );
    addTearDown(container.dispose);
    container.read(bookingDraftProvider.notifier).initialize(service: service);
    container
        .read(bookingDraftProvider.notifier)
        .selectSavedAddress(
          const AddressEntity(
            id: 'address-1',
            label: 'Nhà',
            addressLine: '123 Nguyễn Huệ',
            latitude: 10.77,
            longitude: 106.70,
          ),
        );

    final providers = await container.read(bookingCandidatesProvider.future);
    expect(providers, isEmpty);
    expect(dio.requestBody?['customerAddressId'], 'address-1');
    expect(dio.requestBody?['latitude'], isNull);
    expect(dio.requestBody?['longitude'], isNull);
  });

  test('candidate cannot invent a missing distance', () {
    expect(
      () => BookingProviderCandidateEntity.fromJson({
        'id': 'provider-1',
        'service': {'id': 'provider-service-1'},
      }),
      throwsFormatException,
    );
  });

  test(
    'rematch loads server-filtered candidates for the source order',
    () async {
      final dio = _SearchDio();
      final container = ProviderContainer(
        overrides: [dioProvider.overrideWithValue(dio)],
      );
      addTearDown(container.dispose);
      container
          .read(bookingDraftProvider.notifier)
          .initializeRematch(
            sourceOrderId: 'expired-order',
            service: service,
            orderDraft: {
              'bookingType': 'SCHEDULED',
              'scheduledAt': '2026-10-30T07:00:00.000Z',
              'inlineAddress': {
                'label': 'Nhà',
                'addressLine': '123 Nguyễn Huệ',
                'latitude': 10.77,
                'longitude': 106.70,
              },
              'contactName': 'Khách nhận dịch vụ',
              'contactPhone': '0912345678',
            },
          );

      final candidates = await container.read(bookingCandidatesProvider.future);
      expect(candidates, isEmpty);
      expect(dio.getPath, '/me/orders/expired-order/rematch-candidates');
      expect(dio.getQuery, {'radiusKm': 30, 'limit': 20});
      expect(dio.requestBody, isNull);
      final draft = container.read(bookingDraftProvider)!;
      expect(draft.contactPhone, '0912345678');
      expect(
        draft.scheduledAt,
        DateTime.parse('2026-10-30T07:00:00.000Z').toLocal(),
      );
    },
  );
}

class _SearchDio extends DioMixin implements Dio {
  Map<String, dynamic>? requestBody;
  String? getPath;
  Map<String, dynamic>? getQuery;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    getPath = path;
    getQuery = queryParameters;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: {
        'success': true,
        'data': {'candidates': []},
      } as T,
    );
  }

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
    requestBody = data as Map<String, dynamic>;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': []} as T,
    );
  }
}

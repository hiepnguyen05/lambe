import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/shared/address/domain/entities/address_entity.dart';
import 'package:mobile/features/customer/booking/data/booking_order_submission_service.dart';
import 'package:mobile/features/customer/booking/data/booking_rematch_service.dart';
import 'package:mobile/features/customer/booking/domain/entities/booking_draft_entity.dart';
import 'package:mobile/features/customer/booking/domain/entities/inline_order_address.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';
import 'package:mobile/features/customer/booking/presentation/providers/booking_draft_provider.dart';

void main() {
  late _MockDio mockDio;
  late BookingOrderSubmissionService service;

  const sampleService = ServiceItemEntity(
    id: 'srv-1',
    code: 'CAT-TOC-NAM',
    name: 'Cắt tóc nam phong cách',
    slug: 'cat-toc-nam',
    minPriceAmount: 120000,
    maxPriceAmount: 200000,
    currencyCode: 'VND',
    defaultDurationMinutes: 45,
    category: ServiceCategorySummaryEntity(
      id: 'cat-1',
      code: 'TOC',
      name: 'Tóc',
      slug: 'toc',
    ),
  );

  setUp(() {
    mockDio = _MockDio();
    service = BookingOrderSubmissionService(mockDio);
  });

  group('BookingOrderSubmissionService Tests', () {
    test('submits order with saved address ID and returns order ID', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/orders'),
        statusCode: 201,
        data: {
          'success': true,
          'data': {'id': 'ORD-9999', 'status': 'PENDING_PROVIDER'},
        },
      );

      final draft = BookingDraftEntity(
        service: sampleService,
        providerId: 'prv-1',
        providerServiceId: 'ps-100',
        addressSource: 'SAVED',
        customerAddressId: 'addr-saved-1',
        bookingType: BookingType.asap,
      );

      final order = await service.submitOrder(
        draft: draft,
        contactName: 'Nguyễn Văn A',
        contactPhone: '0912345678',
        customerNote: 'Bấm chuông khi tới',
        quoteToken: 'test-quote-token',
      );

      expect(order.id, 'ORD-9999');
      expect(order.status, 'PENDING_PROVIDER');
      expect(mockDio.lastData['providerServiceId'], 'ps-100');
      expect(mockDio.lastData['bookingType'], 'ASAP');
      expect(mockDio.lastData['customerAddressId'], 'addr-saved-1');
      expect(mockDio.lastData['contactName'], 'Nguyễn Văn A');
      expect(mockDio.lastData['contactPhone'], '0912345678');
      expect(mockDio.lastData['customerNote'], 'Bấm chuông khi tới');
      expect(mockDio.lastData['quoteToken'], 'test-quote-token');

      final sentHeader = mockDio.lastOptions?.headers?['idempotency-key'];
      expect(sentHeader, isNotNull);
      expect(sentHeader.toString().startsWith('order_'), isTrue);
    });

    test(
      'does not invent an order ID when the server response is incomplete',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(path: '/orders'),
          statusCode: 201,
          data: {
            'success': true,
            'data': {'status': 'PENDING_PROVIDER'},
          },
        );
        final draft = BookingDraftEntity(
          service: sampleService,
          providerServiceId: 'ps-100',
          customerAddressId: 'addr-1',
        );

        expect(
          () => service.submitOrder(
            draft: draft,
            contactName: 'Nguyễn Văn A',
            contactPhone: '0912345678',
            customerNote: '',
            quoteToken: 'test-quote-token',
          ),
          throwsFormatException,
        );
      },
    );

    test('populates label in inlineAddress when using selectedAddress without saved ID', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/orders'),
        statusCode: 201,
        data: {
          'success': true,
          'data': {'id': 'ORD-8888', 'status': 'PENDING_PROVIDER'},
        },
      );

      const selectedAddr = AddressEntity(
        id: '',
        label: 'Văn phòng làm việc',
        addressLine: '123 Đường ABC, Quận 1, TP.HCM',
        latitude: 10.7769,
        longitude: 106.7009,
      );

      final draft = BookingDraftEntity(
        service: sampleService,
        providerId: 'prv-1',
        providerServiceId: 'ps-200',
        addressSource: 'INLINE',
        customerAddressId: null,
        selectedAddress: selectedAddr,
        bookingType: BookingType.scheduled,
        scheduledAt: DateTime.utc(2026, 10, 20, 14, 0),
      );

      final order = await service.submitOrder(
        draft: draft,
        contactName: 'Trần Thị B',
        contactPhone: '0987654321',
        customerNote: '',
        quoteToken: 'test-quote-token',
      );

      expect(order.id, 'ORD-8888');
      final inlineAddr =
          mockDio.lastData['inlineAddress'] as Map<String, dynamic>;
      expect(inlineAddr['label'], 'Văn phòng làm việc');
      expect(inlineAddr['addressLine'], '123 Đường ABC, Quận 1, TP.HCM');
      expect(inlineAddr['latitude'], 10.7769);
      expect(inlineAddr['longitude'], 106.7009);
      expect(mockDio.lastData['scheduledAt'], isNotNull);
    });

    test('sends top-level voucherCode in order payload', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/orders'),
        statusCode: 201,
        data: {
          'success': true,
          'data': {'id': 'ORD-7777', 'status': 'PENDING_PROVIDER'},
        },
      );

      final draft = BookingDraftEntity(
        service: sampleService,
        providerServiceId: 'ps-300',
        customerAddressId: 'addr-1',
      );

      await service.submitOrder(
        draft: draft,
        contactName: 'Lê C',
        contactPhone: '0933333333',
        customerNote: 'Làm nhẹ tay',
        quoteToken: 'test-quote-token',
        voucherCode: 'lambe50',
      );

      expect(mockDio.lastData['voucherCode'], 'LAMBE50');
      expect(mockDio.lastData['customerNote'], 'Làm nhẹ tay');
    });

    test('retry sends only a new provider and quote, preserving the original snapshot on server', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/orders/source-1/retry'),
        statusCode: 201,
        data: {
          'success': true,
          'data': {'id': 'new-order', 'status': 'PENDING_PROVIDER'},
        },
      );
      final draft = BookingDraftEntity(
        service: sampleService,
        rematchSourceOrderId: 'source-1',
        providerServiceId: 'new-provider-service',
        addressSource: 'INLINE',
        inlineAddress: const InlineOrderAddress(
          label: 'Nhà',
          addressLine: '123 Đường A',
          latitude: 10.77,
          longitude: 106.7,
        ),
        contactName: 'Khách gốc',
        contactPhone: '0912345678',
        customerNote: 'Ghi chú gốc',
      );

      final order = await service.submitOrder(
        draft: draft,
        contactName: 'Tên đã sửa',
        contactPhone: '0988888888',
        customerNote: 'Ghi chú đã sửa',
        quoteToken: 'new-quote',
        voucherCode: 'lambe20',
      );

      expect(order.id, 'new-order');
      expect(mockDio.lastPath, '/me/orders/source-1/retry');
      expect(mockDio.lastData, {
        'providerServiceId': 'new-provider-service',
        'quoteToken': 'new-quote',
        'voucherCode': 'LAMBE20',
      });
      expect(mockDio.lastOptions?.headers?['idempotency-key'], isNotNull);
    });

    test('loads rematch snapshot after app restart without an existing booking draft', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(
          path: '/me/orders/source-1/rematch-candidates',
        ),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'service': {
              ...sampleService.toJson(),
              'category': sampleService.category.toJson(),
            },
            'orderDraft': {
              'bookingType': 'SCHEDULED',
              'scheduledAt': '2026-10-30T07:00:00.000Z',
              'inlineAddress': {
                'label': 'Nhà',
                'addressLine': '123 Đường A',
                'latitude': 10.77,
                'longitude': 106.7,
              },
              'contactName': 'Khách gốc',
              'contactPhone': '0912345678',
              'customerNote': 'Gọi trước',
            },
          },
        },
      );

      final source = await BookingRematchService(mockDio).load('source-1');
      final container = ProviderContainer();
      container.read(bookingDraftProvider.notifier).initializeRematch(
        sourceOrderId: 'source-1',
        service: source.service,
        orderDraft: source.orderDraft,
      );

      expect(mockDio.lastPath, '/me/orders/source-1/rematch-candidates');
      final draft = container.read(bookingDraftProvider);
      expect(draft?.rematchSourceOrderId, 'source-1');
      expect(draft?.service.name, sampleService.name);
      expect(draft?.inlineAddress?.addressLine, '123 Đường A');
      expect(draft?.contactPhone, '0912345678');
      expect(draft?.bookingType, BookingType.scheduled);
      container.dispose();
    });

    test(
      'parses backend validation message on DioException badResponse',
      () async {
        mockDio.errorToThrow = DioException(
          requestOptions: RequestOptions(path: '/orders'),
          response: Response(
            requestOptions: RequestOptions(path: '/orders'),
            statusCode: 400,
            data: {'success': false, 'message': 'Thợ đã bận vào khung giờ này'},
          ),
          type: DioExceptionType.badResponse,
        );

        final draft = BookingDraftEntity(
          service: sampleService,
          providerServiceId: 'ps-400',
          customerAddressId: 'addr-1',
        );

        expect(
          () => service.submitOrder(
            draft: draft,
            contactName: 'Test',
            contactPhone: '0912345678',
            customerNote: '',
            quoteToken: 'test-quote-token',
          ),
          throwsA(
            isA<Exception>().having(
              (e) => e.toString(),
              'message',
              contains('Thợ đã bận vào khung giờ này'),
            ),
          ),
        );
      },
    );

    test(
      'reuses idempotency key after timeout and resets it after success',
      () async {
        mockDio.errorToThrow = DioException(
          requestOptions: RequestOptions(path: '/orders'),
          type: DioExceptionType.connectionTimeout,
        );

        final draft = BookingDraftEntity(
          service: sampleService,
          providerServiceId: 'ps-500',
          customerAddressId: 'addr-1',
        );

        // Lần 1 thất bại
        try {
          await service.submitOrder(
            draft: draft,
            contactName: 'Test',
            contactPhone: '0912345678',
            customerNote: '',
            quoteToken: 'test-quote-token',
          );
        } catch (_) {}

        final firstKey = mockDio.lastOptions?.headers?['idempotency-key'];

        // Lần 2 thành công
        mockDio.errorToThrow = null;
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(path: '/orders'),
          statusCode: 201,
          data: {
            'success': true,
            'data': {'id': 'ORD-SUCCESS', 'status': 'PENDING_PROVIDER'},
          },
        );

        // Chờ 2ms để timestamp khác biệt
        await Future<void>.delayed(const Duration(milliseconds: 2));

        await service.submitOrder(
          draft: draft,
          contactName: 'Test',
          contactPhone: '0912345678',
          customerNote: '',
          quoteToken: 'test-quote-token',
        );

        final secondKey = mockDio.lastOptions?.headers?['idempotency-key'];
        expect(secondKey, firstKey);

        await service.submitOrder(
          draft: draft,
          contactName: 'Test',
          contactPhone: '0912345678',
          customerNote: '',
          quoteToken: 'test-quote-token',
        );
        final thirdKey = mockDio.lastOptions?.headers?['idempotency-key'];
        expect(thirdKey, isNot(firstKey));
      },
    );

    test('getQuote parses response and returns OrderQuoteEntity', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/orders/quote'),
        statusCode: 200,
        data: {
          'success': true,
          'data': {
            'providerServiceId': 'ps-quote-1',
            'serviceName': 'Cắt tóc nam phong cách',
            'servicePriceAmount': 150000,
            'travelFeeAmount': 0,
            'totalAmount': 150000,
            'currencyCode': 'VND',
            'durationMinutes': 45,
            'distanceKm': 2.5,
            'bookingType': 'ASAP',
            'available': true,
          },
        },
      );

      final draft = BookingDraftEntity(
        service: sampleService,
        providerId: 'prv-1',
        providerServiceId: 'ps-quote-1',
        addressSource: 'SAVED',
        customerAddressId: 'addr-saved-1',
        bookingType: BookingType.asap,
      );

      final quote = await service.getQuote(draft: draft);
      expect(quote.available, isTrue);
      expect(quote.servicePriceAmount, 150000);
      expect(quote.travelFeeAmount, 0);
      expect(quote.totalAmount, 150000);
      expect(quote.distanceKm, 2.5);
    });

    test('getQuote returns unavailable quote on 409 conflict', () async {
      mockDio.errorToThrow = DioException(
        requestOptions: RequestOptions(path: '/orders/quote'),
        response: Response(
          requestOptions: RequestOptions(path: '/orders/quote'),
          statusCode: 409,
          data: {
            'code': 'PROVIDER_TIME_CONFLICT',
            'message': 'Thợ bận lịch vào khung giờ này.',
          },
        ),
      );

      final draft = BookingDraftEntity(
        service: sampleService,
        providerId: 'prv-1',
        providerServiceId: 'ps-conflict-1',
        addressSource: 'SAVED',
        customerAddressId: 'addr-saved-1',
        bookingType: BookingType.asap,
      );

      final quote = await service.getQuote(draft: draft);
      expect(quote.available, isFalse);
      expect(quote.reason, 'Thợ bận lịch vào khung giờ này.');
    });
    test(
      'getQuote with voucherCode sends voucherCode and parses discountAmount',
      () async {
        mockDio.responseToReturn = Response(
          requestOptions: RequestOptions(path: '/orders/quote'),
          statusCode: 200,
          data: {
            'success': true,
            'data': {
              'providerServiceId': 'ps-quote-1',
              'serviceName': 'Cắt tóc nam phong cách',
              'servicePriceAmount': 150000,
              'travelFeeAmount': 12000,
              'travelDistanceKm': 5.0,
              'distanceSource': 'CONSERVATIVE_DISTANCE',
              'subtotalAmount': 162000,
              'discountAmount': 30000,
              'voucherCode': 'LAMBE20',
              'voucherIssuer': 'PLATFORM',
              'totalAmount': 132000,
              'currencyCode': 'VND',
              'durationMinutes': 45,
              'distanceKm': 3.3,
              'bookingType': 'ASAP',
              'available': true,
            },
          },
        );

        final draft = BookingDraftEntity(
          service: sampleService,
          providerId: 'prv-1',
          providerServiceId: 'ps-quote-1',
          addressSource: 'SAVED',
          customerAddressId: 'addr-saved-1',
          bookingType: BookingType.asap,
        );

        final quote = await service.getQuote(
          draft: draft,
          voucherCode: 'lambe20',
        );
        expect(mockDio.lastData['voucherCode'], 'LAMBE20');
        expect(quote.available, isTrue);
        expect(quote.servicePriceAmount, 150000);
        expect(quote.travelFeeAmount, 12000);
        expect(quote.travelDistanceKm, 5.0);
        expect(quote.subtotalAmount, 162000);
        expect(quote.discountAmount, 30000);
        expect(quote.voucherCode, 'LAMBE20');
        expect(quote.voucherIssuer, 'PLATFORM');
        expect(quote.totalAmount, 132000);
      },
    );

    test('getEligibleVouchers returns parsed list of VoucherEntity', () async {
      mockDio.responseToReturn = Response(
        requestOptions: RequestOptions(path: '/me/vouchers'),
        statusCode: 200,
        data: {
          'success': true,
          'data': [
            {
              'code': 'LAMBE20',
              'issuer': 'PLATFORM',
              'discountType': 'PERCENTAGE',
              'value': 20,
              'maxDiscountAmount': 30000,
              'minOrderAmount': 100000,
              'endsAt': '2026-11-19T00:00:00.000Z',
              'estimatedDiscountAmount': 30000,
            },
          ],
        },
      );

      final vouchers = await service.getEligibleVouchers('ps-quote-1');
      expect(vouchers.length, 1);
      final v = vouchers.first;
      expect(v.code, 'LAMBE20');
      expect(v.isPlatform, isTrue);
      expect(v.isPercentage, isTrue);
      expect(v.value, 20);
      expect(v.maxDiscountAmount, 30000);
      expect(v.estimatedDiscountAmount, 30000);
    });
  });
}

class _MockDio extends DioMixin implements Dio {
  String? lastPath;
  dynamic lastData;
  Map<String, dynamic>? lastQueryParams;
  Options? lastOptions;
  Response<dynamic>? responseToReturn;
  DioException? errorToThrow;

  @override
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
    ProgressCallback? onReceiveProgress,
  }) async {
    lastPath = path;
    lastData = data;
    lastQueryParams = queryParameters;
    lastOptions = options;
    if (errorToThrow != null) {
      throw errorToThrow!;
    }
    return responseToReturn as Response<T>;
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
    lastPath = path;
    lastData = data;
    lastQueryParams = queryParameters;
    lastOptions = options;
    if (errorToThrow != null) {
      throw errorToThrow!;
    }
    return responseToReturn as Response<T>;
  }
}

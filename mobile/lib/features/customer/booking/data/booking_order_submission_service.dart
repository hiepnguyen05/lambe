import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/network/api_response_parser.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/utils/uuid_utils.dart';

import '../domain/entities/booking_draft_entity.dart';
import '../domain/entities/booking_submission_entity.dart';
import '../domain/entities/order_quote_entity.dart';
import '../domain/entities/voucher_entity.dart';
import '../domain/repositories/booking_order_repository.dart';

final bookingOrderRepositoryProvider = Provider<BookingOrderRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return BookingOrderSubmissionService(dio);
});

final bookingOrderSubmissionServiceProvider = bookingOrderRepositoryProvider;

class BookingOrderSubmissionService implements BookingOrderRepository {
  final Dio _dio;
  String? _sessionIdempotencyKey;
  String? _pendingPayload;

  BookingOrderSubmissionService(this._dio);

  String generateIdempotencyKey() {
    return 'order_${UuidUtils.generateV4()}';
  }

  String getOrCreateIdempotencyKey() {
    if (_sessionIdempotencyKey != null) {
      return _sessionIdempotencyKey!;
    }
    _sessionIdempotencyKey = generateIdempotencyKey();
    return _sessionIdempotencyKey!;
  }

  void resetIdempotencyKey() {
    _sessionIdempotencyKey = null;
    _pendingPayload = null;
  }

  Map<String, dynamic> _buildBaseOrderPayload(BookingDraftEntity draft) {
    final Map<String, dynamic> body = {
      'providerServiceId': draft.providerServiceId,
      'bookingType': draft.bookingType.toApiValue(),
    };

    if (draft.assignedMemberId != null &&
        draft.assignedMemberId!.isNotEmpty) {
      body['memberId'] = draft.assignedMemberId;
    }

    if (draft.bookingType == BookingType.scheduled &&
        draft.scheduledAt != null) {
      body['scheduledAt'] = draft.scheduledAt!.toUtc().toIso8601String();
    }

    if (draft.addressSource == 'SAVED' && draft.customerAddressId != null) {
      body['customerAddressId'] = draft.customerAddressId;
    } else if (draft.inlineAddress != null) {
      body['inlineAddress'] = draft.inlineAddress!.toJson();
    } else if (draft.selectedAddress != null) {
      final addr = draft.selectedAddress!;
      body['inlineAddress'] = {
        'label': (addr.label?.isNotEmpty ?? false)
            ? addr.label!
            : 'Địa chỉ phục vụ',
        'addressLine': addr.addressLine,
        'latitude': addr.latitude,
        'longitude': addr.longitude,
      };
    }

    return body;
  }

  String _parseErrorMessage(DioException e, {required String fallback}) {
    final resData = e.response?.data;
    if (resData is Map<String, dynamic>) {
      final msg = resData['message'];
      if (msg is String && msg.isNotEmpty) {
        return msg;
      } else if (msg is List && msg.isNotEmpty) {
        return msg.first.toString();
      }
    } else if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.connectionError) {
      return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại mạng.';
    } else if (e.message != null && e.message!.isNotEmpty) {
      return e.message!;
    }
    return fallback;
  }

  /// Lấy danh sách voucher hợp lệ cho dịch vụ của thợ: GET /api/me/vouchers?providerServiceId=...
  @override
  Future<List<VoucherEntity>> getEligibleVouchers(
    String providerServiceId,
  ) async {
    try {
      final response = await _dio.get(
        ApiEndpoints.eligibleVouchers(providerServiceId),
      );
      final list = ApiResponseParser.dataList(response);
      return list
          .whereType<Map<String, dynamic>>()
          .map((v) => VoucherEntity.fromJson(v))
          .toList();
    } on DioException catch (e) {
      throw Exception(
        _parseErrorMessage(
          e,
          fallback: 'Không thể lấy danh sách ưu đãi khả dụng.',
        ),
      );
    }
  }

  /// Lấy báo giá chính thức từ máy chủ: POST /api/orders/quote
  @override
  Future<OrderQuoteEntity> getQuote({
    required BookingDraftEntity draft,
    String? voucherCode,
  }) async {
    final body = _buildBaseOrderPayload(draft);
    if (voucherCode != null && voucherCode.trim().isNotEmpty) {
      body['voucherCode'] = voucherCode.trim().toUpperCase();
    }

    try {
      final response = await _dio.post(ApiEndpoints.ordersQuote, data: body);

      final data = ApiResponseParser.dataMap(response);
      return OrderQuoteEntity.fromJson(data);
    } on DioException catch (e) {
      final resData = e.response?.data;
      if (e.response?.statusCode == 409 && resData is Map<String, dynamic>) {
        final innerData = resData['data'];
        if (innerData is Map<String, dynamic>) {
          return OrderQuoteEntity.fromJson(innerData);
        }
        final servicePrice =
            draft.providerPriceAmount ?? draft.service.minPriceAmount;
        return OrderQuoteEntity(
          providerServiceId: draft.providerServiceId ?? '',
          serviceName: draft.service.name,
          servicePriceAmount: servicePrice,
          totalAmount: servicePrice,
          voucherCode: voucherCode?.trim().toUpperCase(),
          bookingType: draft.bookingType.toApiValue(),
          available: false,
          reason:
              resData['message']?.toString() ??
              'Thợ không thể nhận đơn vào khung giờ này.',
        );
      }
      throw Exception(
        _parseErrorMessage(
          e,
          fallback: 'Không thể lấy báo giá dịch vụ, vui lòng thử lại.',
        ),
      );
    }
  }

  /// Tạo đơn hàng chính thức: POST /api/orders
  @override
  Future<BookingSubmissionEntity> submitOrder({
    required BookingDraftEntity draft,
    required String contactName,
    required String contactPhone,
    required String customerNote,
    required String quoteToken,
    String? voucherCode,
  }) async {
    final sourceId = draft.rematchSourceOrderId;
    final body = sourceId == null
        ? _buildBaseOrderPayload(draft)
        : <String, dynamic>{'providerServiceId': draft.providerServiceId};
    body['quoteToken'] = quoteToken;

    final trimmedContactName = sourceId == null ? contactName.trim() : '';
    if (trimmedContactName.isNotEmpty) {
      body['contactName'] = trimmedContactName;
    }

    final trimmedContactPhone = sourceId == null ? contactPhone.trim() : '';
    if (trimmedContactPhone.isNotEmpty) {
      body['contactPhone'] = trimmedContactPhone;
    }

    final trimmedNote = sourceId == null ? customerNote.trim() : '';
    if (trimmedNote.isNotEmpty) {
      body['customerNote'] = trimmedNote;
    }

    if (voucherCode != null && voucherCode.trim().isNotEmpty) {
      body['voucherCode'] = voucherCode.trim().toUpperCase();
    }

    final fingerprint = jsonEncode([sourceId, body]);
    if (_pendingPayload != fingerprint) {
      resetIdempotencyKey();
      _pendingPayload = fingerprint;
    }
    final key = getOrCreateIdempotencyKey();

    try {
      final response = await _dio.post(
        sourceId == null
            ? ApiEndpoints.orders
            : ApiEndpoints.retryOrder(sourceId),
        data: body,
        options: Options(headers: {'idempotency-key': key}),
      );

      final data = ApiResponseParser.dataMap(response);
      final order = BookingSubmissionEntity.fromJson(data);
      resetIdempotencyKey();
      return order;
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) resetIdempotencyKey();
      throw Exception(
        _parseErrorMessage(
          e,
          fallback: 'Không thể đặt lịch, vui lòng thử lại.',
        ),
      );
    }
  }
}

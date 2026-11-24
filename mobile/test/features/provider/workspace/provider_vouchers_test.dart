import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/workspace/application/provider_vouchers_notifier.dart';
import 'package:mobile/features/provider/workspace/data/datasources/provider_vouchers_remote_datasource.dart';
import 'package:mobile/features/provider/workspace/domain/entities/provider_voucher_entity.dart';

class MockProviderVouchersRemoteDataSource
    implements ProviderVouchersRemoteDataSource {
  List<ProviderVoucherEntity> mockList = [];
  Map<String, dynamic>? lastCreatedPayload;
  String? lastDisabledId;

  @override
  Future<List<ProviderVoucherEntity>> getProviderVouchers({
    int page = 1,
    int limit = 50,
  }) async {
    return mockList;
  }

  @override
  Future<ProviderVoucherEntity> createProviderVoucher(
    Map<String, dynamic> data,
  ) async {
    lastCreatedPayload = data;
    final newVoucher = ProviderVoucherEntity(
      id: 'voucher-new',
      code: data['code']?.toString() ?? '',
      issuer: 'PROVIDER',
      discountType: data['discountType']?.toString() ?? 'PERCENTAGE',
      value: (data['value'] as num?)?.toInt() ?? 10,
      maxDiscountAmount: (data['maxDiscountAmount'] as num?)?.toInt(),
      minOrderAmount: (data['minOrderAmount'] as num?)?.toInt() ?? 0,
      startsAt: DateTime.parse(data['startsAt']),
      endsAt: DateTime.parse(data['endsAt']),
      usageLimit: (data['usageLimit'] as num?)?.toInt() ?? 50,
      perCustomerLimit: (data['perCustomerLimit'] as num?)?.toInt() ?? 1,
      status: 'ACTIVE',
      createdAt: DateTime.now(),
    );
    mockList = [...mockList, newVoucher];
    return newVoucher;
  }

  @override
  Future<void> disableProviderVoucher(String voucherId) async {
    lastDisabledId = voucherId;
    mockList = mockList.map((v) {
      if (v.id == voucherId) {
        return ProviderVoucherEntity(
          id: v.id,
          code: v.code,
          issuer: v.issuer,
          discountType: v.discountType,
          value: v.value,
          maxDiscountAmount: v.maxDiscountAmount,
          minOrderAmount: v.minOrderAmount,
          startsAt: v.startsAt,
          endsAt: v.endsAt,
          usageLimit: v.usageLimit,
          perCustomerLimit: v.perCustomerLimit,
          status: 'INACTIVE',
          disabledAt: DateTime.now(),
          createdAt: v.createdAt,
        );
      }
      return v;
    }).toList();
  }
}

void main() {
  group('ProviderVoucherEntity Tests', () {
    test('fromJson parses full voucher payload correctly', () {
      final json = {
        'id': 'v-123',
        'code': 'THO20',
        'issuer': 'PROVIDER',
        'discountType': 'PERCENTAGE',
        'value': 20,
        'maxDiscountAmount': 50000,
        'minOrderAmount': 150000,
        'startsAt': '2026-10-01T00:00:00.000Z',
        'endsAt': '2026-11-01T00:00:00.000Z',
        'usageLimit': 100,
        'perCustomerLimit': 2,
        'status': 'ACTIVE',
        'disabledAt': null,
        'createdAt': '2026-10-01T00:00:00.000Z',
      };

      final voucher = ProviderVoucherEntity.fromJson(json);

      expect(voucher.id, 'v-123');
      expect(voucher.code, 'THO20');
      expect(voucher.isPercentage, true);
      expect(voucher.value, 20);
      expect(voucher.maxDiscountAmount, 50000);
      expect(voucher.minOrderAmount, 150000);
      expect(voucher.usageLimit, 100);
      expect(voucher.perCustomerLimit, 2);
      expect(voucher.isDisabled, false);
      expect(voucher.discountDescription, 'Giảm 20% (tối đa 50.000 đ)');
    });

    test(
      'isDisabled returns true when status is INACTIVE or disabledAt is set',
      () {
        final voucher = ProviderVoucherEntity(
          id: 'v-dis',
          code: 'OFF10',
          issuer: 'PROVIDER',
          discountType: 'FIXED_AMOUNT',
          value: 10000,
          startsAt: DateTime.now().subtract(const Duration(days: 1)),
          endsAt: DateTime.now().add(const Duration(days: 10)),
          usageLimit: 10,
          status: 'INACTIVE',
          disabledAt: DateTime.now(),
          createdAt: DateTime.now(),
        );

        expect(voucher.isDisabled, true);
        expect(voucher.statusLabel, 'Đã ngừng');
        expect(voucher.discountDescription, 'Giảm 10.000 đ');
      },
    );
  });

  group('ProviderVouchersNotifier Tests', () {
    late MockProviderVouchersRemoteDataSource mockDs;
    late ProviderVouchersNotifier notifier;

    setUp(() {
      mockDs = MockProviderVouchersRemoteDataSource();
      mockDs.mockList = [
        ProviderVoucherEntity(
          id: 'v-1',
          code: 'SALE10',
          issuer: 'PROVIDER',
          discountType: 'PERCENTAGE',
          value: 10,
          startsAt: DateTime.now().subtract(const Duration(days: 1)),
          endsAt: DateTime.now().add(const Duration(days: 10)),
          usageLimit: 20,
          status: 'ACTIVE',
          createdAt: DateTime.now(),
        ),
      ];
      notifier = ProviderVouchersNotifier(mockDs);
    });

    test('loads vouchers on initialization', () async {
      await notifier.loadVouchers();
      expect(notifier.state.vouchers.length, 1);
      expect(notifier.state.vouchers.first.code, 'SALE10');
      expect(notifier.state.isLoading, false);
      expect(notifier.state.errorMessage, null);
    });

    test(
      'createVoucher calls datasource with uppercase code and refreshes list',
      () async {
        final success = await notifier.createVoucher(
          code: 'trian15',
          discountType: 'PERCENTAGE',
          value: 15,
          maxDiscountAmount: 30000,
          minOrderAmount: 100000,
          startsAt: DateTime.now(),
          endsAt: DateTime.now().add(const Duration(days: 14)),
          usageLimit: 30,
        );

        expect(success, true);
        expect(mockDs.lastCreatedPayload?['code'], 'TRIAN15');
        expect(mockDs.lastCreatedPayload?['discountType'], 'PERCENTAGE');
        expect(mockDs.lastCreatedPayload?['value'], 15);
        expect(notifier.state.vouchers.length, 2);
      },
    );

    test('disableVoucher updates voucher status to inactive', () async {
      final success = await notifier.disableVoucher('v-1');

      expect(success, true);
      expect(mockDs.lastDisabledId, 'v-1');
      expect(notifier.state.vouchers.first.isDisabled, true);
    });
  });
}

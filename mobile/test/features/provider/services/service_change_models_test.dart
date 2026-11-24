import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/services/data/provider_service_mapper.dart';
import 'package:mobile/features/provider/services/domain/service_change.dart';
import 'package:mobile/features/provider/services/domain/service_change_draft.dart';

import 'support/service_fakes.dart';

void main() {
  test(
    'floor and ceiling are inclusive; invalid price and duration are rejected',
    () {
      final definition = definitionFromJson(definitionJson());
      for (final amount in [50000, 200000]) {
        expect(draft(price: amount).validate(definition: definition), isNull);
      }
      for (final amount in [0, 49999, 200001, 2000000001]) {
        expect(
          draft(price: amount).validate(definition: definition),
          isNotNull,
        );
      }
      for (final duration in [null, 15, 720]) {
        expect(
          draft(duration: duration).validate(definition: definition),
          isNull,
        );
      }
      for (final duration in [0, 14, 721]) {
        expect(
          draft(duration: duration).validate(definition: definition),
          isNotNull,
        );
      }
    },
  );
  test('new services do not invent a catalog price band and validate name/category', () {
    expect(
      draft(type: ServiceChangeType.proposeNew, price: 1).validate(),
      isNull,
    );
    expect(
      const ServiceChangeDraft(
        type: ServiceChangeType.proposeNew,
        price: 50000,
        name: 'a',
      ).validate(),
      isNotNull,
    );
    expect(
      const ServiceChangeDraft(
        type: ServiceChangeType.proposeNew,
        price: 50000,
        categoryId: 'cat',
        name: 'Nail',
        description: 'Okay',
      ).validate(),
      isNull,
    );
  });
  test('transport contains exactly the fields for each intent, with nullable resets', () {
    final update = draftToJson(draft(), creating: true);
    expect(update, {
      'type': 'UPDATE_OFFERING',
      'providerServiceId': 'offering',
      'proposedPriceAmount': 120000,
      'proposedDurationMinutes': 75,
      'proposedDescription': 'Mô tả mới',
    });
    expect(
      draftToJson(draft(type: ServiceChangeType.addExisting), creating: true),
      containsPair('serviceId', 'service'),
    );
    final newService = draftToJson(
      draft(type: ServiceChangeType.proposeNew),
      creating: true,
    );
    expect(newService['name'], 'Tạo kiểu đi tiệc');
    expect(newService, isNot(contains('serviceId')));
    expect(newService, isNot(contains('providerServiceId')));
    expect(
      draftToJson(draft(duration: null))['proposedDurationMinutes'],
      isNull,
    );
    expect(draftToJson(draft()), isNot(contains('type')));
  });
  for (final status in ServiceChangeStatus.values) {
    test(
      '${status.wire} preserves review feedback and only permits its real actions',
      () {
        final value = changeFromJson(changeJson(status: status));
        expect(
          value.editable,
          [
            ServiceChangeStatus.draft,
            ServiceChangeStatus.needsChanges,
          ].contains(status),
        );
        expect(
          value.canWithdraw,
          [
            ServiceChangeStatus.draft,
            ServiceChangeStatus.needsChanges,
            ServiceChangeStatus.pending,
          ].contains(status),
        );
        if (status == ServiceChangeStatus.needsChanges) {
          expect(value.reviewNote, contains('chứng chỉ'));
        }
      },
    );
  }
  test('mapper rejects corrupted price bands and financial amounts', () {
    expect(
      () => definitionFromJson({...definitionJson(), 'minPriceAmount': 300000}),
      throwsFormatException,
    );
    expect(
      () => offeringFromJson({...offeringJson(), 'priceAmount': '100000'}),
      throwsFormatException,
    );
  });
  test('blockers cannot be bypassed by activating an unavailable offering', () {
    expect(
      offeringFromJson(offeringJson(status: 'SUSPENDED', blocker: 'SUSPENDED'))
          .canToggle,
      isFalse,
    );
    expect(
      offeringFromJson(
        offeringJson(status: 'INACTIVE', blocker: 'CATEGORY_INACTIVE'),
      ).canToggle,
      isFalse,
    );
    expect(
      offeringFromJson(offeringJson(blocker: 'PRICE_OUT_OF_RANGE')).canToggle,
      isTrue,
    );
  });
}

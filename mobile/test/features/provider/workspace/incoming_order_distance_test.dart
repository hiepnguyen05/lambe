import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/provider/workspace/domain/entities/incoming_order_entity.dart';

void main() {
  test(
    'pending order shows the priced distance without customer coordinates',
    () {
      final order = IncomingOrderEntity.fromJson({
        'id': 'order-1',
        'bookingType': 'ASAP',
        'travelDistanceKm': 5.3,
        'addressLatitude': null,
        'addressLongitude': null,
      });

      expect(order.distanceKm, 5.3);
    },
  );

  test(
    'missing priced distance is not replaced with a fabricated location',
    () {
      final order = IncomingOrderEntity.fromJson({'id': 'order-2'});

      expect(order.distanceKm, isNull);
    },
  );
}

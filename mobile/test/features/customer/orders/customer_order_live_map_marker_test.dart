import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/presentation/widgets/tracking/customer_order_live_map.dart';
import 'package:mobile/features/provider/workspace/presentation/widgets/execution/provider_order_tracking_map.dart';
import 'package:mobile/features/shared/address/presentation/widgets/location/address_map_picker.dart';

const _destination = LatLng(21.031, 105.839);
const _start = LatLng(21.028, 105.834);
const _next = LatLng(21.030, 105.838);
const _route = [_start, LatLng(21.029, 105.835), _destination];
const _order = CustomerOrderEntity(
  id: 'order-1',
  bookingType: 'ASAP',
  status: 'EN_ROUTE',
  serviceName: 'Dịch vụ',
  servicePriceAmount: 0,
  totalAmount: 0,
);

void main() {
  testWidgets('customer map shows the real route and moves smoothly', (
    tester,
  ) async {
    await tester.pumpWidget(
      _map(
        CustomerOrderLiveMap(
          mapController: MapController(),
          order: _order,
          customerLatLng: _destination,
          providerLatLng: _start,
          routePoints: _route,
          durationSeconds: 720,
          distanceMeters: 2400,
        ),
      ),
    );

    expect(find.text('12 phút'), findsOneWidget);
    expect(find.text('2,4 km'), findsOneWidget);
    expect(find.text('© OpenStreetMap'), findsOneWidget);
    expect(find.byIcon(Icons.location_on_rounded), findsOneWidget);
    expect(find.byIcon(Icons.spa_rounded), findsNothing);
    expect(find.byIcon(Icons.delivery_dining_rounded), findsOneWidget);
    expect(find.byIcon(Icons.two_wheeler_rounded), findsNothing);
    expect(_routeOnMap(tester), _route);
    expect(_currentMarker(tester), _start);

    await tester.pumpWidget(
      _map(
        CustomerOrderLiveMap(
          mapController: MapController(),
          order: _order,
          customerLatLng: _destination,
          providerLatLng: _next,
          routePoints: _route,
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 2250));
    final midway = _currentMarker(tester);
    expect(midway.latitude, greaterThan(_start.latitude));
    expect(midway.latitude, lessThan(_next.latitude));
    expect(tester.takeException(), isNull);
  });

  testWidgets('provider map uses the same route and offers navigation', (
    tester,
  ) async {
    await tester.pumpWidget(
      _map(
        ProviderOrderTrackingMap(
          mapController: MapController(),
          customerLatLng: _destination,
          providerLatLng: _start,
          routePoints: _route,
          durationSeconds: 360,
          distanceMeters: 1700,
        ),
      ),
    );

    expect(_routeOnMap(tester), _route);
    expect(find.text('6 phút'), findsOneWidget);
    expect(find.text('1,7 km'), findsOneWidget);
    expect(find.text('Bạn ở đây'), findsOneWidget);
    expect(find.byTooltip('Mở chỉ đường'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('address map has no false marker and accepts a selected point', (
    tester,
  ) async {
    LatLng? selected;
    await tester.pumpWidget(
      _map(
        AddressMapPicker(
          latitude: null,
          longitude: null,
          mapController: MapController(),
          onMapTap: (point) => selected = point,
        ),
      ),
    );

    expect(find.text('Chạm để chọn vị trí'), findsOneWidget);
    expect(
      tester.widget<MarkerLayer>(find.byType(MarkerLayer)).markers,
      isEmpty,
    );
    await tester.tap(find.byType(FlutterMap));
    await tester.pump(const Duration(milliseconds: 300));
    expect(selected, isNotNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('trip summary fits a narrow map with large text', (tester) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      _map(
        CustomerOrderLiveMap(
          mapController: MapController(),
          order: _order,
          customerLatLng: _destination,
          providerLatLng: _start,
          durationSeconds: 720,
          distanceMeters: 2400,
        ),
        textScaler: const TextScaler.linear(2),
      ),
    );

    expect(find.text('12 phút'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Widget _map(Widget child, {TextScaler textScaler = TextScaler.noScaling}) {
  return MaterialApp(
    home: MediaQuery(
      data: MediaQueryData(textScaler: textScaler),
      child: Scaffold(body: SizedBox(height: 320, child: child)),
    ),
  );
}

List<LatLng> _routeOnMap(WidgetTester tester) {
  final layer = tester.widget<PolylineLayer>(find.byType(PolylineLayer));
  return layer.polylines.last.points;
}

LatLng _currentMarker(WidgetTester tester) {
  final layer = tester.widget<MarkerLayer>(find.byType(MarkerLayer));
  return layer.markers.last.point;
}

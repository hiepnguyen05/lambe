import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/app_map_tile_layer.dart';

void main() {
  testWidgets('LambeMapTone applies the branded map color treatment', (
    tester,
  ) async {
    const childKey = Key('map-tile');

    await tester.pumpWidget(
      const MaterialApp(
        home: LambeMapTone(child: SizedBox(key: childKey)),
      ),
    );

    expect(find.byType(ColorFiltered), findsOneWidget);
    expect(find.byKey(childKey), findsOneWidget);
  });

  testWidgets('tracking map tone keeps map colors visible', (tester) async {
    const childKey = Key('tracking-map-tile');

    await tester.pumpWidget(
      const MaterialApp(
        home: LambeTrackingMapTone(child: SizedBox(key: childKey)),
      ),
    );

    final opacity = tester.widget<Opacity>(find.byType(Opacity));
    expect(opacity.opacity, greaterThan(0.9));
    expect(opacity.opacity, lessThanOrEqualTo(1));
    expect(find.byType(ColorFiltered), findsOneWidget);
    expect(find.byType(ColoredBox), findsWidgets);
    expect(find.byKey(childKey), findsOneWidget);

    final matrix = LambeTrackingMapTone.colorMatrix;
    expect(matrix[0], greaterThan(matrix[5]));
    expect(matrix[6], greaterThan(matrix[1]));
    expect(matrix[12], greaterThan(matrix[2]));
  });
}

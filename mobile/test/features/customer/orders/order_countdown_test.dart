import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/order_countdown.dart';

void main() {
  testWidgets('ticks without rebuilding its parent and expires once', (
    tester,
  ) async {
    var parentBuilds = 0;
    var expirations = 0;
    var now = DateTime(2026, 10, 20, 10);
    final deadline = now.add(const Duration(seconds: 2));

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) {
            parentBuilds++;
            return OrderCountdown(
              deadline: deadline,
              now: () => now,
              onExpired: () => expirations++,
              builder: (_, remaining) => Text('${remaining.inSeconds}'),
            );
          },
        ),
      ),
    );

    now = now.add(const Duration(seconds: 3));
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(seconds: 1));

    expect(parentBuilds, 1);
    expect(expirations, 1);
    expect(find.text('0'), findsOneWidget);
  });
}

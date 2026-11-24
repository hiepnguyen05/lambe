import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/mascot/lambe_mascot.dart';

void main() {
  group('LambeMascot Widget Tests', () {
    testWidgets('renders properly with default options', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: LambeMascot(
                size: 100,
                isPlaying: true,
              ),
            ),
          ),
        ),
      );

      expect(find.byType(LambeMascot), findsOneWidget);
      expect(find.byType(CustomPaint), findsWidgets);

      // Advance one animation tick
      await tester.pump(const Duration(milliseconds: 50));
    });

    testWidgets('invokes onTap callback and triggers action', (tester) async {
      var tapped = false;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: LambeMascot(
                size: 80,
                isPlaying: true,
                onTap: () => tapped = true,
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.byType(LambeMascot));
      await tester.pump(const Duration(milliseconds: 16));

      expect(tapped, isTrue);
    });

    testWidgets('renders when isPlaying is false without starting animation', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(
              child: LambeMascot(
                size: 64,
                isPlaying: false,
                showSparkles: false,
                showShadow: false,
              ),
            ),
          ),
        ),
      );

      expect(find.byType(LambeMascot), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 100));
    });
  });
}


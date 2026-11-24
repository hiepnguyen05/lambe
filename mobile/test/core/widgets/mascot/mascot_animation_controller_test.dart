import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/widgets/mascot/controllers/mascot_animation_controller.dart';

void main() {
  group('MascotAnimationController Tests', () {
    testWidgets('initializes with idle action and default values', (tester) async {
      await tester.pumpWidget(const SizedBox());
      final vsync = tester;
      final controller = MascotAnimationController(vsync: vsync);

      expect(controller.currentAction, MascotAction.idle);
      expect(controller.flyX, 0.0);
      expect(controller.flyY, 0.0);
      expect(controller.elapsedTime, 0.0);

      controller.dispose();
    });

    testWidgets('triggerWave and triggerJump switch actions properly', (tester) async {
      await tester.pumpWidget(const SizedBox());
      final vsync = tester;
      final controller = MascotAnimationController(vsync: vsync);

      controller.triggerWave();
      expect(controller.currentAction, MascotAction.wave);

      controller.triggerJump();
      expect(controller.currentAction, MascotAction.jump);

      controller.dispose();
    });

    testWidgets('triggerNextAction cycles between wave and jump', (tester) async {
      await tester.pumpWidget(const SizedBox());
      final vsync = tester;
      final controller = MascotAnimationController(vsync: vsync);

      controller.triggerNextAction();
      expect(controller.currentAction, MascotAction.jump);

      controller.triggerNextAction();
      expect(controller.currentAction, MascotAction.wave);

      controller.triggerNextAction();
      expect(controller.currentAction, MascotAction.jump);

      controller.dispose();
    });

    testWidgets('setPlaying toggles active state', (tester) async {
      await tester.pumpWidget(const SizedBox());
      final vsync = tester;
      final controller = MascotAnimationController(vsync: vsync);

      controller.setPlaying(false);
      // Verify no exception on updatePointer or notify
      controller.updatePointer(0.5, -0.5);
      expect(controller.targetRotY, 0.25);
      expect(controller.targetRotX, 0.15);

      controller.setPlaying(true);
      controller.dispose();
    });
  });
}

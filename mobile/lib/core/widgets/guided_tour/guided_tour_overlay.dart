import 'package:flutter/material.dart';

class GuidedTourStep {
  final String title, message;
  final String? target;
  const GuidedTourStep(this.title, this.message, {this.target});
}

class GuidedTourOverlay extends StatefulWidget {
  final List<GuidedTourStep> steps;
  final int initialStep;
  final Rect? Function(String?) targetBounds;
  final Future<void> Function(String?) revealTarget;
  final void Function(int, String) onProgress;
  const GuidedTourOverlay({
    super.key,
    required this.steps,
    required this.targetBounds,
    required this.revealTarget,
    required this.onProgress,
    this.initialStep = 0,
  });

  @override
  State<GuidedTourOverlay> createState() => _GuidedTourOverlayState();
}

class _GuidedTourOverlayState extends State<GuidedTourOverlay> {
  final _surfaceKey = GlobalKey();
  late int _index;
  Rect? _bounds;
  bool _moving = false;
  @override
  void initState() {
    super.initState();
    _index = widget.initialStep.clamp(0, widget.steps.length - 1);
    WidgetsBinding.instance.addPostFrameCallback((_) => _reveal());
    WidgetsBinding.instance.addPostFrameCallback(_trackTarget);
  }

  void _trackTarget(Duration _) {
    if (!mounted) return;
    final surface = _surfaceKey.currentContext?.findRenderObject();
    final target = _moving
        ? null
        : widget.targetBounds(widget.steps[_index].target);
    Rect? bounds;
    if (target != null && surface is RenderBox && surface.hasSize) {
      final local = Rect.fromPoints(
        surface.globalToLocal(target.topLeft),
        surface.globalToLocal(target.bottomRight),
      ).intersect(Offset.zero & surface.size);
      if (!local.isEmpty) bounds = local;
    }
    if (_bounds != bounds) setState(() => _bounds = bounds);
    // Follow scrolling and layout changes without requesting continuous frames.
    WidgetsBinding.instance.addPostFrameCallback(_trackTarget);
  }

  Future<void> _reveal() async {
    if (!mounted) return;
    setState(() => _moving = true);
    await widget.revealTarget(widget.steps[_index].target);
    if (!mounted) return;
    setState(() => _moving = false);
  }

  void _advance(int index) {
    setState(() {
      _index = index;
      _bounds = null;
    });
    widget.onProgress(_index, 'STARTED');
    _reveal();
  }

  @override
  Widget build(BuildContext context) {
    final step = widget.steps[_index];
    final bottomTarget =
        _bounds != null &&
        _bounds!.center.dy > MediaQuery.sizeOf(context).height * .55;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) {
          widget.onProgress(_index, 'DISMISSED');
          Navigator.of(context).pop();
        }
      },
      child: Material(
        color: Colors.transparent,
        child: Stack(
          key: _surfaceKey,
          children: [
            Positioned.fill(
              child: CustomPaint(painter: _SpotlightPainter(_bounds)),
            ),
            SafeArea(
              child: Align(
                alignment: bottomTarget
                    ? Alignment.topCenter
                    : Alignment.bottomCenter,
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(20),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 480),
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'HƯỚNG DẪN · ${_index + 1}/${widget.steps.length}',
                              style: Theme.of(context).textTheme.labelMedium
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .primary,
                                  ),
                            ),
                            const SizedBox(height: 12),
                            Semantics(
                              liveRegion: true,
                              child: Text(
                                step.title,
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              step.message,
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                            const SizedBox(height: 20),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              alignment: WrapAlignment.end,
                              children: [
                                TextButton(
                                  onPressed: () {
                                    widget.onProgress(_index, 'DISMISSED');
                                    Navigator.of(context).pop();
                                  },
                                  child: const Text('Để sau'),
                                ),
                                if (_index > 0)
                                  TextButton(
                                    onPressed: _moving
                                        ? null
                                        : () => _advance(_index - 1),
                                    child: const Text('Quay lại'),
                                  ),
                                FilledButton(
                                  onPressed: _moving
                                      ? null
                                      : () {
                                          if (_index ==
                                              widget.steps.length - 1) {
                                            widget.onProgress(
                                              _index,
                                              'COMPLETED',
                                            );
                                            Navigator.of(context).pop();
                                          } else {
                                            _advance(_index + 1);
                                          }
                                        },
                                  child: Text(
                                    _index == widget.steps.length - 1
                                        ? 'Đã hiểu'
                                        : 'Tiếp theo',
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SpotlightPainter extends CustomPainter {
  final Rect? target;
  const _SpotlightPainter(this.target);
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()..addRect(Offset.zero & size);
    if (target != null) {
      path.addRRect(
        RRect.fromRectAndRadius(target!.inflate(6), const Radius.circular(16)),
      );
      path.fillType = PathFillType.evenOdd;
    }
    canvas.drawPath(path, Paint()..color = Colors.black.withValues(alpha: .65));
  }

  @override
  bool shouldRepaint(covariant _SpotlightPainter oldDelegate) =>
      target != oldDelegate.target;
}

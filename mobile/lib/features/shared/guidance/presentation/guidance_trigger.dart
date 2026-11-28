import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/widgets/guided_tour/guided_tour_overlay.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../application/guidance_controller.dart';
import 'guidance_catalog.dart';

final _targetsProvider = Provider((ref) => <String, Set<GlobalKey>>{});

class GuidanceAnchor extends ConsumerStatefulWidget {
  final String id;
  final Widget child;
  const GuidanceAnchor({super.key, required this.id, required this.child});
  @override
  ConsumerState<GuidanceAnchor> createState() => _GuidanceAnchorState();
}

class _GuidanceAnchorState extends ConsumerState<GuidanceAnchor> {
  final _anchor = GlobalKey();
  late Map<String, Set<GlobalKey>> _targets;
  @override
  void initState() {
    super.initState();
    _targets = ref.read(_targetsProvider);
    _targets.putIfAbsent(widget.id, () => {}).add(_anchor);
  }

  @override
  void dispose() {
    _unregister(widget.id);
    super.dispose();
  }

  void _unregister(String id) {
    final anchors = _targets[id];
    anchors?.remove(_anchor);
    if (anchors?.isEmpty == true) _targets.remove(id);
  }

  @override
  void didUpdateWidget(covariant GuidanceAnchor oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.id != widget.id) {
      _unregister(oldWidget.id);
      _targets.putIfAbsent(widget.id, () => {}).add(_anchor);
    }
  }

  @override
  Widget build(BuildContext context) =>
      KeyedSubtree(key: _anchor, child: widget.child);
}

Future<void> showGuidance(
  BuildContext context,
  WidgetRef ref,
  String tourId, {
  int start = 0,
  void Function(Route<void>)? onRoute,
}) async {
  final tour = guidanceTours[tourId];
  if (tour == null || ref.read(guidanceBusyProvider)) return;
  final userId = ref.read(authNotifierProvider).valueOrNull?.id;
  if (userId == null) return;
  final records = await ref.read(guidanceProgressProvider.future);
  if (!context.mounted ||
      ref.read(authNotifierProvider).valueOrNull?.id != userId ||
      ref.read(guidanceBusyProvider)) {
    return;
  }
  final alreadyCompleted =
      records[tourId]?.version == tour.version &&
      records[tourId]?.status == 'COMPLETED';
  final pageRoute = ModalRoute.of(context);
  final targets = ref.read(_targetsProvider);
  BuildContext? targetContext(String? id) {
    for (final anchor in targets[id] ?? <GlobalKey>{}) {
      final target = anchor.currentContext;
      if (target != null && ModalRoute.of(target) == pageRoute) return target;
    }
    return null;
  }

  final busy = ref.read(guidanceBusyProvider.notifier);
  final controller = ref.read(guidanceProgressProvider.notifier);
  busy.state = true;
  final route = DialogRoute<void>(
    context: context,
    useSafeArea: false,
    barrierDismissible: false,
    barrierColor: Colors.transparent,
    builder: (_) => GuidedTourOverlay(
      steps: tour.steps,
      initialStep: start,
      revealTarget: (id) async {
        final target = targetContext(id);
        if (target != null) {
          await Scrollable.ensureVisible(
            target,
            duration: const Duration(milliseconds: 250),
            alignment: .4,
          );
        }
      },
      targetBounds: (id) {
        final box = targetContext(id)?.findRenderObject();
        if (box is! RenderBox || !box.hasSize || !box.attached) return null;
        return box.localToGlobal(Offset.zero) & box.size;
      },
      onProgress: (step, status) {
        if (alreadyCompleted && status != 'COMPLETED') return;
        if (ref.read(authNotifierProvider).valueOrNull?.id == userId) {
          controller.save(tourId, tour.version, step, status);
        }
      },
    ),
  );
  onRoute?.call(route);
  if (!alreadyCompleted) {
    controller.save(tourId, tour.version, start, 'STARTED');
  }
  try {
    await Navigator.of(context, rootNavigator: true).push(route);
  } finally {
    busy.state = false;
  }
}

class GuidanceTrigger extends ConsumerStatefulWidget {
  final String tourId;
  final Widget child;
  final bool enabled;
  const GuidanceTrigger({
    super.key,
    required this.tourId,
    required this.child,
    this.enabled = true,
  });
  @override
  ConsumerState<GuidanceTrigger> createState() => _GuidanceTriggerState();
}

class _GuidanceTriggerState extends ConsumerState<GuidanceTrigger> {
  Timer? _retry;
  Route<void>? _route;
  String? _checked;
  bool _checking = false;
  void _closeTour() {
    final route = _route;
    _route = null;
    if (route == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      route.navigator?.removeRoute(route);
    });
  }

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  void _schedule() {
    _retry?.cancel();
    _retry = Timer(const Duration(milliseconds: 700), _check);
  }

  Future<void> _check() async {
    if (!mounted || !widget.enabled || _checking) return;
    final userId = ref.read(authNotifierProvider).valueOrNull?.id;
    final identity = '$userId:${widget.tourId}';
    if (userId == null || _checked == identity) return;
    if (ModalRoute.of(context)?.isCurrent != true ||
        ref.read(guidanceBusyProvider) ||
        MediaQuery.viewInsetsOf(context).bottom > 0 ||
        (WidgetsBinding.instance.lifecycleState != null &&
            WidgetsBinding.instance.lifecycleState !=
                AppLifecycleState.resumed)) {
      _schedule();
      return;
    }
    _checking = true;
    try {
      final records = await ref.read(guidanceProgressProvider.future);
      if (!mounted ||
          !widget.enabled ||
          ref.read(authNotifierProvider).valueOrNull?.id != userId) {
        return;
      }
      if (ModalRoute.of(context)?.isCurrent != true ||
          ref.read(guidanceBusyProvider) ||
          MediaQuery.viewInsetsOf(context).bottom > 0 ||
          (WidgetsBinding.instance.lifecycleState != null &&
              WidgetsBinding.instance.lifecycleState !=
                  AppLifecycleState.resumed)) {
        _schedule();
        return;
      }
      final progress = records[widget.tourId];
      final tour = guidanceTours[widget.tourId];
      if (tour == null) return;
      _checked = identity;
      if (progress?.version == tour.version &&
          ['COMPLETED', 'DISMISSED'].contains(progress?.status)) {
        return;
      }
      await showGuidance(
        context,
        ref,
        widget.tourId,
        start: progress?.version == tour.version ? progress!.stepIndex : 0,
        onRoute: (route) => _route = route,
      );
    } finally {
      _checking = false;
      _route = null;
    }
  }

  @override
  void didUpdateWidget(covariant GuidanceTrigger oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.enabled || oldWidget.tourId != widget.tourId) _closeTour();
    _schedule();
  }

  @override
  void dispose() {
    _retry?.cancel();
    _closeTour();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(authNotifierProvider.select((a) => a.valueOrNull?.id), (
      previous,
      next,
    ) {
      if (previous != next) {
        _closeTour();
        _checked = null;
        _schedule();
      }
    });
    return widget.child;
  }
}

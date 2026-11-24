import 'package:flutter/material.dart';
import 'package:mobile/core/routing/app_route_observer.dart';

import '../../data/feed_engagement_reporter.dart';

class FeedEngagementTracker extends StatefulWidget {
  final String postId;
  final FeedEngagementReporter reporter;
  final Widget child;
  final bool enabled;
  const FeedEngagementTracker({
    super.key,
    required this.postId,
    required this.reporter,
    required this.child,
    this.enabled = true,
  });
  @override
  State<FeedEngagementTracker> createState() => _FeedEngagementTrackerState();
}

class _FeedEngagementTrackerState extends State<FeedEngagementTracker>
    with
        WidgetsBindingObserver,
        RouteAware,
        RouteVisibility<FeedEngagementTracker> {
  final _watch = Stopwatch();
  bool _viewed = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && ModalRoute.of(context)?.isCurrent == true) {
        onVisibilityChanged(true);
      }
    });
  }

  @override
  void onVisibilityChanged(bool visible) {
    if (!widget.enabled) return;
    if (visible) {
      if (!_viewed) {
        widget.reporter.report(widget.postId, 'VIEW');
        _viewed = true;
      }
      _watch.start();
    } else {
      _flush();
    }
  }

  @override
  void didUpdateWidget(covariant FeedEngagementTracker oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reporter != widget.reporter ||
        oldWidget.postId != widget.postId) {
      _watch.stop();
      _watch.reset();
      _viewed = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && ModalRoute.of(context)?.isCurrent == true) {
          onVisibilityChanged(true);
        }
      });
    }
  }

  void _flush() {
    _watch.stop();
    final ms = _watch.elapsedMilliseconds;
    if (_viewed && ms > 0) {
      widget.reporter.report(widget.postId, ms < 3000 ? 'SKIP' : 'DWELL', ms);
    }
    _watch.reset();
  }

  @override
  void dispose() {
    _flush();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

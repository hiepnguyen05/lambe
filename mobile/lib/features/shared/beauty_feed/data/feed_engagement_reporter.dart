import 'dart:async';

import 'package:dio/dio.dart';
import 'package:mobile/core/utils/uuid_utils.dart';

class FeedEngagementReporter {
  final Dio dio;
  final bool signedIn;
  final bool enabled;
  final _cancel = CancelToken();
  FeedEngagementReporter(
    this.dio, {
    required this.signedIn,
    this.enabled = const bool.fromEnvironment('FEED_RECOMMENDATIONS_ENABLED'),
  });

  void report(String postId, String kind, [int? durationMs]) {
    if (!enabled || !signedIn || _cancel.isCancelled) return;
    unawaited(_send(postId, kind, durationMs));
  }

  Future<void> _send(String postId, String kind, int? durationMs) async {
    try {
      await dio.post(
        '/me/feed/posts/$postId/engagements',
        data: {
          'clientEventId': UuidUtils.generateV4(),
          'kind': kind,
          if (durationMs != null) 'durationMs': durationMs.clamp(0, 300000),
        },
        cancelToken: _cancel,
        options: Options(
          sendTimeout: const Duration(seconds: 5),
          receiveTimeout: const Duration(seconds: 5),
        ),
      );
    } catch (_) {
      /* Analytics must never block reading or booking. */
    }
  }

  void dispose() => _cancel.cancel();
}

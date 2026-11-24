import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile/features/provider/location/application/provider_location_coordinator.dart';
import 'package:mobile/features/shared/tracking/domain/order_tracking_snapshot.dart';

class LocationHarness {
  final DateTime Function() clock;
  final bool backgroundExecution;
  final channels = <StreamController<Position>>[];
  final highModes = <bool>[];
  final tracks = <Position>[], hearts = <Position>[];
  final tokens = <CancelToken>[];
  int active = 0, peak = 0, captures = 0, checks = 0, orderChecks = 0;
  bool serverOnline = false, failSensor = false;
  String orderStatus = 'EN_ROUTE';
  Future<Position> Function()? captureResult;
  Future<void> Function()? heartbeatResult;
  Future<bool> Function()? availabilityResult;
  Future<OrderTrackingSnapshot?> Function(Position)? sendResult;
  Future<Map<String, dynamic>> Function()? orderResult;
  late final coordinator = ProviderLocationCoordinator(
    clock: clock,
    backgroundExecution: backgroundExecution,
    locate: (_) {
      captures++;
      return captureResult?.call() ?? Future.value(point());
    },
    positions: (high) {
      if (failSensor) throw StateError('No permission');
      highModes.add(high);
      final channel = StreamController<Position>(
        sync: true,
        onListen: () {
          active++;
          if (active > peak) peak = active;
        },
        onCancel: () async {
          active--;
        },
      );
      channels.add(channel);
      return channel.stream;
    },
    heartbeat: (p, token) {
      hearts.add(p);
      tokens.add(token);
      return heartbeatResult?.call() ?? Future.value();
    },
    availability: (token) {
      checks++;
      tokens.add(token);
      return availabilityResult?.call() ?? Future.value(serverOnline);
    },
    send: (id, p, token) {
      tracks.add(p);
      tokens.add(token);
      return sendResult?.call(p) ?? Future.value(null);
    },
    getOrder: (id, token) {
      orderChecks++;
      tokens.add(token);
      return orderResult?.call() ?? Future.value({'status': orderStatus});
    },
  );
  LocationHarness(this.clock, {this.backgroundExecution = false});
  Position point({double lat = 21, double accuracy = 5, DateTime? at}) =>
      Position(
        latitude: lat,
        longitude: 105,
        timestamp: at ?? clock(),
        accuracy: accuracy,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );
  void emit(Position p) => channels.last.add(p);
  void dispose() {
    coordinator.dispose();
    for (final c in channels) {
      unawaited(c.close());
    }
  }
}

T finish<T>(FakeAsync time, Future<T> future) {
  var completed = false;
  T? result;
  Object? error;
  future.then(
    (v) {
      result = v;
      completed = true;
    },
    onError: (Object e) {
      error = e;
      completed = true;
    },
  );
  time.flushMicrotasks();
  expect(
    completed,
    isTrue,
    reason: 'operation must complete without waiting for a periodic timer',
  );
  if (error != null) throw error!;
  return result as T;
}

void locationTest(
  String name,
  void Function(FakeAsync, LocationHarness) body, {
  bool backgroundExecution = false,
}) => test(name, () {
  fakeAsync((time) {
    final h = LocationHarness(
      () => DateTime.utc(2026, 11, 4).add(time.elapsed),
      backgroundExecution: backgroundExecution,
    );
    try {
      body(time, h);
    } finally {
      h.dispose();
      time.flushMicrotasks();
    }
    expect(time.periodicTimerCount, 0);
    expect(h.active, 0);
  });
});
void main() {
  locationTest(
    'Android keeps one already started idle service in background and stops it offline',
    (t, h) {
      finish(t, h.coordinator.confirmedOnline(true));
      expect(h.active, 1);
      h.emit(h.point());
      t.flushMicrotasks();
      finish(t, h.coordinator.setForeground(false));
      expect(h.active, 1);
      t.elapse(const Duration(seconds: 60));
      h.emit(h.point(lat: 21.01));
      t.flushMicrotasks();
      expect(h.hearts, hasLength(2));
      finish(t, h.coordinator.confirmedOnline(false));
      expect(h.active, 0);
      t.elapse(const Duration(minutes: 2));
      expect(h.hearts, hasLength(2));
    },
    backgroundExecution: true,
  );
  locationTest(
    'Android retains EN_ROUTE service in background but stops after order ends',
    (t, h) {
      finish(t, h.coordinator.start('order'));
      h.emit(h.point());
      t.flushMicrotasks();
      finish(t, h.coordinator.setForeground(false));
      t.elapse(const Duration(seconds: 10));
      h.emit(h.point(lat: 21.01));
      t.flushMicrotasks();
      expect(h.tracks, hasLength(2));
      finish(t, h.coordinator.stop(onlyOrderId: 'order'));
      expect(h.active, 0);
    },
    backgroundExecution: true,
  );
  locationTest(
    'logout stops receiving and order tracking together in background',
    (t, h) {
      finish(t, h.coordinator.confirmedOnline(true));
      finish(t, h.coordinator.start('order'));
      h.emit(h.point());
      t.flushMicrotasks();
      finish(t, h.coordinator.setForeground(false));
      expect(h.active, 1);
      final heartCount = h.hearts.length, trackCount = h.tracks.length;
      finish(t, h.coordinator.stopAll());
      expect(h.active, 0);
      expect(h.coordinator.online, isFalse);
      expect(h.coordinator.orderId, isNull);
      t.elapse(const Duration(minutes: 2));
      expect(h.hearts, hasLength(heartCount));
      expect(h.tracks, hasLength(trackCount));
    },
    backgroundExecution: true,
  );
  locationTest(
    'Android cannot start a new service while already backgrounded',
    (t, h) {
      finish(t, h.coordinator.setForeground(false));
      finish(t, h.coordinator.start('order'));
      expect(h.active, 0);
      expect(h.highModes, isEmpty);
      h.orderStatus = 'EN_ROUTE';
      finish(t, h.coordinator.setForeground(true));
      expect(h.active, 1);
    },
    backgroundExecution: true,
  );
  locationTest(
    'Android cancels a pending native stream if the app backgrounds before its first fix',
    (t, h) {
      finish(t, h.coordinator.confirmedOnline(true));
      expect(h.active, 1);
      finish(t, h.coordinator.setForeground(false));
      expect(h.active, 0);
      t.elapse(const Duration(minutes: 2));
      expect(h.hearts, isEmpty);
    },
    backgroundExecution: true,
  );
  locationTest(
    'Android resume verifies online state before reopening a sensor',
    (t, h) {
      h.serverOnline = true;
      finish(t, h.coordinator.confirmedOnline(true));
      h.emit(h.point());
      t.flushMicrotasks();
      finish(t, h.coordinator.setForeground(false));
      expect(h.active, 1);
      h.serverOnline = false;
      finish(t, h.coordinator.setForeground(true));
      expect(h.checks, 1);
      expect(h.coordinator.online, isFalse);
      expect(h.active, 0);
    },
    backgroundExecution: true,
  );
  locationTest(
    'Android GPS stream error stops background uploads until a visible retry',
    (t, h) {
      finish(t, h.coordinator.confirmedOnline(true));
      h.emit(h.point());
      t.flushMicrotasks();
      h.channels.last.addError(StateError('GPS disabled'));
      t.flushMicrotasks();
      expect(h.active, 0);
      finish(t, h.coordinator.setForeground(false));
      h.emit(h.point());
      t.elapse(const Duration(minutes: 2));
      expect(h.hearts, hasLength(1));
      expect(h.coordinator.availabilityKnown, isFalse);
    },
    backgroundExecution: true,
  );
  for (final status in ['EN_ROUTE', 'ARRIVED']) {
    locationTest(
      'tracking 409 verifies order $status instead of treating stale GPS as completion',
      (t, h) {
        h.orderStatus = status;
        h.sendResult = (_) => Future.error(
          DioException(
            requestOptions: RequestOptions(path: '/location'),
            response: Response(
              requestOptions: RequestOptions(path: '/location'),
              statusCode: 409,
            ),
          ),
        );
        finish(t, h.coordinator.start('order'));
        h.emit(h.point());
        t.flushMicrotasks();
        expect(h.orderChecks, 1);
        expect(h.coordinator.orderId, status == 'EN_ROUTE' ? 'order' : null);
      },
    );
  }
  locationTest(
    'offline never opens a sensor or timer-driven location request',
    (t, h) {
      finish(t, h.coordinator.confirmedOnline(false));
      t.elapse(const Duration(minutes: 3));
      expect(h.active, 0);
      expect(h.captures, 0);
      expect(h.hearts, isEmpty);
      expect(h.tracks, isEmpty);
    },
  );
  locationTest(
    'availability and tracking share one sensor and cancel old sensor before switching accuracy',
    (t, h) {
      finish(t, h.coordinator.confirmedOnline(true));
      finish(t, h.coordinator.start('order'));
      expect(h.active, 1);
      expect(h.peak, 1);
      expect(h.highModes, [false, true]);
      finish(t, h.coordinator.stop(onlyOrderId: 'order'));
      expect(h.highModes.last, isFalse);
      finish(t, h.coordinator.confirmedOnline(false));
      expect(h.active, 0);
    },
  );
  locationTest(
    'idle sends heartbeat every 60 seconds from stream without polling current position',
    (t, h) {
      finish(t, h.coordinator.confirmedOnline(true));
      h.emit(h.point());
      t.flushMicrotasks();
      expect(h.hearts, hasLength(1));
      t.elapse(const Duration(seconds: 59));
      h.emit(h.point(lat: 21.01));
      t.flushMicrotasks();
      expect(h.hearts, hasLength(1));
      t.elapse(const Duration(seconds: 1));
      expect(h.hearts, hasLength(2));
      expect(h.captures, 0);
    },
  );
  locationTest(
    'EN_ROUTE throttles small movement and does not resend acknowledged timestamps',
    (t, h) {
      finish(t, h.coordinator.start('order'));
      h.emit(h.point());
      t.flushMicrotasks();
      t.elapse(const Duration(seconds: 6));
      h.emit(h.point(lat: 21.00001));
      t.flushMicrotasks();
      expect(h.tracks, hasLength(1));
      t.elapse(const Duration(seconds: 4));
      expect(h.tracks, hasLength(2));
      t.elapse(const Duration(seconds: 10));
      expect(h.tracks, hasLength(2));
      expect(h.captures, 0);
    },
  );
  locationTest(
    'one upload in flight retains only the newest buffered GPS across heartbeat and tracking',
    (t, h) {
      final held = Completer<OrderTrackingSnapshot?>();
      h.sendResult = (_) => held.future;
      finish(t, h.coordinator.confirmedOnline(true));
      finish(t, h.coordinator.start('order'));
      h.emit(h.point());
      t.flushMicrotasks();
      expect(h.hearts, isEmpty);
      for (var i = 1; i <= 5; i++) {
        t.elapse(const Duration(seconds: 2));
        h.emit(h.point(lat: 21 + i / 100));
        t.flushMicrotasks();
      }
      expect(h.tracks, hasLength(1));
      h.sendResult = (_) async => null;
      held.complete(null);
      t.flushMicrotasks();
      expect(h.tracks.map((p) => p.latitude), [21, 21.05]);
      expect(h.hearts.single.latitude, 21.05);
    },
  );
  for (final sample in ['old', 'future', 'inaccurate', 'invalid']) {
    locationTest('rejects $sample samples', (t, h) {
      finish(t, h.coordinator.start('order'));
      h.emit(switch (sample) {
        'old' => h.point(at: h.clock().subtract(const Duration(seconds: 31))),
        'future' => h.point(at: h.clock().add(const Duration(seconds: 11))),
        'inaccurate' => h.point(accuracy: 101),
        _ => h.point(lat: double.nan),
      });
      t.flushMicrotasks();
      expect(h.tracks, isEmpty);
      expect(h.coordinator.currentPosition, isNull);
    });
  }
  locationTest('older samples cannot move the marker backwards', (t, h) {
    finish(t, h.coordinator.start('order'));
    h.emit(h.point(lat: 21.02));
    t.flushMicrotasks();
    h.emit(
      h.point(lat: 22, at: h.clock().subtract(const Duration(seconds: 1))),
    );
    t.flushMicrotasks();
    expect(h.coordinator.currentPosition!.latitude, 21.02);
    expect(h.tracks, hasLength(1));
  });
  locationTest(
    'simultaneous capture intents share one native request and reuse a fresh sample',
    (t, h) {
      final held = Completer<Position>();
      h.captureResult = () => held.future;
      final a = h.coordinator.capture(requestPermission: true),
          b = h.coordinator.capture();
      expect(h.captures, 1);
      held.complete(h.point());
      finish(t, a);
      finish(t, b);
      finish(t, h.coordinator.capture());
      expect(h.captures, 1);
    },
  );
  locationTest('late one-shot capture after background is rejected', (t, h) {
    final held = Completer<Position>();
    h.captureResult = () => held.future;
    Object? failure;
    h.coordinator.capture().catchError((Object error) {
      failure = error;
      return h.point();
    });
    finish(t, h.coordinator.setForeground(false));
    held.complete(h.point());
    t.flushMicrotasks();
    expect(failure, isStateError);
    expect(h.coordinator.currentPosition, isNull);
    expect(h.active, 0);
  });
  locationTest(
    'background cancels transports and resume never recreates expired receiving intent',
    (t, h) {
      finish(t, h.coordinator.confirmedOnline(true));
      h.emit(h.point());
      t.flushMicrotasks();
      final token = h.tokens.last;
      finish(t, h.coordinator.setForeground(false));
      t.elapse(const Duration(minutes: 3));
      expect(token.isCancelled, isTrue);
      expect(h.active, 0);
      expect(h.coordinator.availabilityKnown, isFalse);
      finish(t, h.coordinator.setForeground(true));
      expect(h.checks, 1);
      expect(h.coordinator.online, isFalse);
      expect(h.active, 0);
      expect(h.hearts, hasLength(1));
    },
  );
  locationTest('resume checks terminal order before restoring GPS', (t, h) {
    finish(t, h.coordinator.start('order'));
    finish(t, h.coordinator.setForeground(false));
    h.orderStatus = 'COMPLETED';
    finish(t, h.coordinator.setForeground(true));
    expect(h.orderChecks, 1);
    expect(h.coordinator.orderId, isNull);
    expect(h.active, 0);
  });
  locationTest(
    'failed availability verification stays unknown without renewing cached coordinates',
    (t, h) {
      finish(t, h.coordinator.confirmedOnline(true));
      finish(t, h.coordinator.setForeground(false));
      h.availabilityResult = () => Future.error(StateError('network'));
      finish(t, h.coordinator.setForeground(true));
      expect(h.coordinator.availabilityKnown, isFalse);
      expect(h.coordinator.issue, isNotNull);
      expect(h.active, 0);
      expect(h.hearts, isEmpty);
    },
  );
  locationTest('heartbeat rejection reconciles server status', (t, h) {
    h.heartbeatResult = () => Future.error(StateError('expired'));
    finish(t, h.coordinator.confirmedOnline(true));
    h.emit(h.point());
    t.flushMicrotasks();
    expect(h.checks, 1);
    expect(h.coordinator.online, isFalse);
    expect(h.active, 0);
  });
  locationTest('stop for an older order leaves the current journey running', (
    t,
    h,
  ) {
    finish(t, h.coordinator.start('current'));
    finish(t, h.coordinator.stop(onlyOrderId: 'old'));
    expect(h.coordinator.orderId, 'current');
    expect(h.active, 1);
  });
  locationTest('order status polling is single flight and stops at ARRIVED', (
    t,
    h,
  ) {
    final held = Completer<Map<String, dynamic>>();
    h.orderResult = () => held.future;
    finish(t, h.coordinator.start('order'));
    t.elapse(const Duration(seconds: 40));
    expect(h.orderChecks, 1);
    held.complete({'status': 'ARRIVED'});
    t.flushMicrotasks();
    expect(h.coordinator.orderId, isNull);
    expect(h.active, 0);
  });
  locationTest('sensor startup error can recover on explicit reconciliation', (
    t,
    h,
  ) {
    h.failSensor = true;
    finish(t, h.coordinator.confirmedOnline(true));
    expect(h.coordinator.availabilityKnown, isFalse);
    h.failSensor = false;
    h.serverOnline = true;
    finish(t, h.coordinator.reconcileAvailability());
    expect(h.active, 1);
  });
  test('dispose cancels in-flight transport and ignores late completion', () {
    fakeAsync((t) {
      final h = LocationHarness(() => DateTime.utc(2026, 11, 4).add(t.elapsed)),
          held = Completer<OrderTrackingSnapshot?>();
      h.sendResult = (_) => held.future;
      finish(t, h.coordinator.start('order'));
      h.emit(h.point());
      t.flushMicrotasks();
      final token = h.tokens.last;
      h.dispose();
      held.complete(null);
      t.elapse(const Duration(minutes: 2));
      t.flushMicrotasks();
      expect(token.isCancelled, isTrue);
      expect(h.active, 0);
      expect(h.tracks, hasLength(1));
      expect(t.periodicTimerCount, 0);
    });
  });
}

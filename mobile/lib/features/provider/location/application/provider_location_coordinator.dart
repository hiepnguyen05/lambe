import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:mobile/features/shared/tracking/domain/order_tracking_snapshot.dart';

/// One sensor and one upload in flight for receiving and EN_ROUTE.
/// On Android, an already started foreground service may continue in background.
class ProviderLocationCoordinator extends ChangeNotifier {
  final Future<Position> Function(bool) locate;
  final Stream<Position> Function(bool) positions;
  final Future<void> Function(Position, CancelToken) heartbeat;
  final Future<bool> Function(CancelToken) availability;
  final Future<OrderTrackingSnapshot?> Function(String, Position, CancelToken)
  send;
  final Future<Map<String, dynamic>> Function(String, CancelToken) getOrder;
  final DateTime Function() now;
  final bool backgroundExecution;
  StreamSubscription<Position>? _subscription;
  Timer? _tick, _statusTimer;
  CancelToken _cancel = CancelToken();
  Future<void> _sensorChange = Future.value();
  Future<Position>? _capture;
  Position? _latest, _lastTrackingPosition;
  OrderTrackingSnapshot? _tracking;
  DateTime? _heartbeatAttempt, _trackingAttempt;
  DateTime? _trackingAcknowledgedAt;
  String? _orderId, _issue;
  bool _online = false,
      _known = false,
      _foreground = true,
      _sending = false,
      _checking = false,
      _checkingOrder = false,
      _disposed = false,
      _reconcilingResume = false,
      _orderVerified = true;
  bool _serviceStarted = false;
  int _generation = 0;

  ProviderLocationCoordinator({
    required this.locate,
    required this.positions,
    required this.heartbeat,
    required this.availability,
    required this.send,
    required this.getOrder,
    DateTime Function()? clock,
    this.backgroundExecution = false,
  }) : now = clock ?? DateTime.now;
  bool get online => _online;
  bool get availabilityKnown => _known;
  bool get foreground => _foreground;
  String? get issue => _issue;
  String? get orderId => _orderId;
  OrderTrackingSnapshot? get tracking => _tracking;
  LatLng? get currentPosition =>
      _latest == null ? null : LatLng(_latest!.latitude, _latest!.longitude);
  bool get _active =>
      !_disposed &&
      (_foreground || (backgroundExecution && _serviceStarted)) &&
      (_online || _orderId != null);

  bool _valid(Position p, {int seconds = 30}) =>
      p.latitude.isFinite &&
      p.longitude.isFinite &&
      p.latitude.abs() <= 90 &&
      p.longitude.abs() <= 180 &&
      p.accuracy.isFinite &&
      p.accuracy >= 0 &&
      p.accuracy <= 100 &&
      now().difference(p.timestamp).inSeconds <= seconds &&
      p.timestamp.difference(now()).inSeconds <= 10;

  Future<Position> capture({bool requestPermission = false}) async {
    if (_disposed || !_foreground) {
      throw StateError('Hãy mở ứng dụng để lấy vị trí.');
    }
    if (_latest != null && _valid(_latest!, seconds: 10)) return _latest!;
    final generation = _generation;
    final pending = _capture ??= locate(requestPermission);
    try {
      final value = await pending;
      if (_disposed || !_foreground || generation != _generation) {
        throw StateError('Phiên vị trí đã thay đổi.');
      }
      if (!_valid(value)) {
        throw StateError('GPS chưa đủ mới/chính xác. Vui lòng thử lại.');
      }
      _receive(value);
      return value;
    } finally {
      if (identical(_capture, pending)) _capture = null;
    }
  }

  Future<void> confirmedOnline(bool value, {Position? seed}) async {
    if (_disposed) return;
    final changed = _online != value || !_known || _subscription == null;
    _online = value;
    _known = true;
    _issue = null;
    if (seed != null && _valid(seed)) {
      _latest = seed;
      _heartbeatAttempt = now();
    }
    _notify();
    if (changed) await _restart();
  }

  Future<void> reconcileAvailability() async {
    if (_disposed || !_foreground || _checking) return;
    _checking = true;
    final generation = _generation, token = _cancel;
    _known = false;
    _notify();
    try {
      final value = await availability(token);
      if (_disposed || !_foreground || generation != _generation) return;
      await confirmedOnline(value);
    } catch (_) {
      if (!_disposed && generation == _generation) {
        _issue = 'Chưa xác minh được trạng thái nhận đơn. Hãy tải lại.';
        _notify();
      }
    } finally {
      _checking = false;
    }
  }

  Future<void> start(String id) async {
    if (_disposed || (id == _orderId && _orderVerified)) return;
    _orderId = id;
    _orderVerified = true;
    _tracking = null;
    _trackingAttempt = null;
    _lastTrackingPosition = null;
    _trackingAcknowledgedAt = null;
    await _restart();
  }

  Future<void> stop({String? onlyOrderId}) async {
    if (_disposed || (onlyOrderId != null && _orderId != onlyOrderId)) return;
    _orderId = null;
    _tracking = null;
    _trackingAttempt = null;
    _lastTrackingPosition = null;
    await _restart();
  }

  Future<void> stopAll() async {
    if (_disposed) return;
    _online = false;
    _known = false;
    _orderId = null;
    _orderVerified = false;
    _tracking = null;
    _trackingAttempt = null;
    _lastTrackingPosition = null;
    _trackingAcknowledgedAt = null;
    await _restart();
  }

  Future<void> setForeground(bool value) async {
    if (_disposed || value == _foreground) return;
    _foreground = value;
    if (!value && backgroundExecution && _serviceStarted) {
      // The native service was started while visible. Keep that same sensor
      // and its notification alive; never start a new location FGS here.
      _notify();
      return;
    }
    if (!value) _orderVerified = false;
    _known = false;
    _reconcilingResume = value;
    await _restart();
    if (value && !_disposed) {
      // Read the server before renewing a receiving session; never auto go-online.
      await reconcileAvailability();
      await _checkOrder();
      _reconcilingResume = false;
      await _restart();
    }
  }

  Future<void> _restart() {
    final generation = ++_generation;
    _cancel.cancel();
    _cancel = CancelToken();
    _tick?.cancel();
    _tick = null;
    _statusTimer?.cancel();
    _statusTimer = null;
    _latest = null;
    if (!_foreground) _tracking = null;
    _notify();
    _sensorChange = _sensorChange
        .then((_) async {
          await _subscription?.cancel();
          _subscription = null;
          _serviceStarted = false;
          if (!_active || generation != _generation || _reconcilingResume) {
            return;
          }
          // Resume waits for explicit server reconciliation below, not cached online UI.
          if (!_known && _orderId == null) return;
          _subscription = positions(_orderId != null && _orderVerified).listen(
            (p) {
              if (generation == _generation) {
                // A subscription is not proof the native FGS has started.
                // Do not retain it in background until the first native fix.
                _serviceStarted = true;
                _receive(p);
              }
            },
            onError: (Object _) {
              if (!_disposed && generation == _generation) {
                final subscription = _subscription;
                _subscription = null;
                if (subscription != null) unawaited(subscription.cancel());
                _serviceStarted = false;
                _tick?.cancel();
                _statusTimer?.cancel();
                _cancel.cancel();
                _latest = null;
                _issue = 'Không cập nhật được GPS. Kiểm tra quyền và định vị.';
                _known = false;
                _notify();
              }
            },
          );
          _tick = Timer.periodic(
            const Duration(seconds: 10),
            (_) => unawaited(_flush()),
          );
          if (_orderId != null) {
            _statusTimer = Timer.periodic(
              const Duration(seconds: 20),
              (_) => unawaited(_checkOrder()),
            );
          }
        })
        .catchError((Object _) {
          if (!_disposed && generation == _generation) {
            _known = false;
            _issue = 'Không mở được GPS. Kiểm tra quyền và thử lại.';
            _notify();
          }
        });
    return _sensorChange;
  }

  void _receive(Position p) {
    if (_disposed ||
        (!_foreground && !_active) ||
        !_valid(p) ||
        (_latest != null && !p.timestamp.isAfter(_latest!.timestamp))) {
      return;
    }
    _latest = p;
    _issue = null;
    _notify();
    unawaited(_flush());
  }

  Future<void> _flush() async {
    final point = _latest;
    if (!_active || _sending || point == null || !_valid(point)) return;
    final generation = _generation,
        id = _orderVerified ? _orderId : null,
        token = _cancel,
        at = now();
    final elapsed = _trackingAttempt == null
        ? 999
        : at.difference(_trackingAttempt!).inSeconds;
    final moved = _lastTrackingPosition == null
        ? double.infinity
        : Geolocator.distanceBetween(
            _lastTrackingPosition!.latitude,
            _lastTrackingPosition!.longitude,
            point.latitude,
            point.longitude,
          );
    final trackDue =
        id != null &&
        (_trackingAcknowledgedAt == null ||
            point.timestamp.isAfter(_trackingAcknowledgedAt!)) &&
        elapsed >= 5 &&
        (elapsed >= 10 || moved >= 25);
    final heartDue =
        _online &&
        (_heartbeatAttempt == null ||
            at.difference(_heartbeatAttempt!).inSeconds >= 60);
    if (!trackDue && !heartDue) return;
    _sending = true;
    try {
      if (trackDue) {
        _trackingAttempt = at;
        _lastTrackingPosition = point;
        try {
          final value = await send(id, point, token);
          if (!_disposed && generation == _generation) {
            _trackingAcknowledgedAt = point.timestamp;
          }
          if (!_disposed && generation == _generation && value != null) {
            _tracking = value;
            _notify();
          }
        } on DioException catch (error) {
          if (!_disposed &&
              generation == _generation &&
              const {403, 404}.contains(error.response?.statusCode)) {
            await stop(onlyOrderId: id);
          } else if (!_disposed &&
              generation == _generation &&
              error.response?.statusCode == 409) {
            // 409 can mean a stale GPS sample; verify the order before ending tracking.
            await _checkOrder();
          }
        } catch (_) {
          /* Next tick uses only the latest fresh sample. */
        }
      }
      if (_disposed || generation != _generation) return;
      if (heartDue) {
        final heartPoint = _latest;
        if (heartPoint == null || !_valid(heartPoint)) return;
        _heartbeatAttempt = now();
        try {
          await heartbeat(heartPoint, token);
          if (!_disposed && generation == _generation && !_known) {
            _known = true;
            _notify();
          }
        } catch (_) {
          if (!_disposed && generation == _generation) {
            await reconcileAvailability();
          }
        }
      }
    } finally {
      _sending = false;
      if (_active &&
          _latest != null &&
          _latest!.timestamp.isAfter(point.timestamp)) {
        unawaited(_flush());
      }
    }
  }

  Future<void> _checkOrder() async {
    final id = _orderId, generation = _generation, token = _cancel;
    if (!_active || id == null || _checkingOrder) return;
    _checkingOrder = true;
    try {
      final value = await getOrder(id, token);
      if (!_disposed && generation == _generation) {
        if (value['status'] != 'EN_ROUTE') {
          await stop(onlyOrderId: id);
        } else if (!_orderVerified) {
          _orderVerified = true;
          await _restart();
        }
      }
    } on DioException catch (error) {
      if (!_disposed &&
          generation == _generation &&
          const {403, 404}.contains(error.response?.statusCode)) {
        await stop(onlyOrderId: id);
      }
    } catch (_) {
      /* Keep last order, do not infer completion from a network error. */
    } finally {
      _checkingOrder = false;
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _cancel.cancel();
    _tick?.cancel();
    _statusTimer?.cancel();
    _latest = null;
    _tracking = null;
    _serviceStarted = false;
    unawaited(_subscription?.cancel());
    super.dispose();
  }
}

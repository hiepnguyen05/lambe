import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/routing/app_route_readiness.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';
import 'package:mobile/features/provider/registration/di/partner_providers.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/shared/chat/di/chat_providers.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notifications_provider.dart';

import '../data/push_device_service.dart';
import '../domain/entities/app_notification_entity.dart';
import 'providers/notifications_providers.dart';

final initialPushMessageProvider = FutureProvider<RemoteMessage?>((ref) async {
  if (Firebase.apps.isEmpty) return null;
  return FirebaseMessaging.instance.getInitialMessage();
});

class PushNotificationCoordinator extends ConsumerStatefulWidget {
  const PushNotificationCoordinator({
    super.key,
    required this.router,
    required this.messengerKey,
    required this.child,
  });

  final GoRouter router;
  final GlobalKey<ScaffoldMessengerState> messengerKey;
  final Widget child;

  static bool shouldShowForegroundBanner(Map<String, dynamic> data) => false;

  @override
  ConsumerState<PushNotificationCoordinator> createState() =>
      _PushNotificationCoordinatorState();
}

class _PushNotificationCoordinatorState
    extends ConsumerState<PushNotificationCoordinator>
    with WidgetsBindingObserver {
  StreamSubscription<RemoteMessage>? _foreground;
  StreamSubscription<RemoteMessage>? _opened;
  StreamSubscription<String>? _tokenRefresh;
  RemoteMessage? _pendingOpen;
  String? _registeredUserId;
  bool _registering = false;
  bool _navigationScheduled = false;
  bool _registrationDeferred = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    widget.router.routerDelegate.addListener(_schedulePendingNavigation);
    unawaited(
      ref
          .read(initialPushMessageProvider.future)
          .then((message) {
            if (mounted && message != null) _openMessage(message);
          })
          .catchError((Object error) {
            debugPrint('Unable to read initial push: $error');
          }),
    );
    if (Firebase.apps.isEmpty) return;
    _foreground = FirebaseMessaging.onMessage.listen(_refreshOnMessage);
    _opened = FirebaseMessaging.onMessageOpenedApp.listen(_openMessage);
    _tokenRefresh = FirebaseMessaging.instance.onTokenRefresh.listen((token) {
      if (_registeredUserId != null) {
        unawaited(_registerToken(token));
      }
    });
    unawaited(
      FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
        alert: false,
        badge: false,
        sound: false,
      ),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _registeredUserId != null) {
      unawaited(_register());
    }
  }

  bool get _isSupportedPlatform =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  Future<void> _register() async {
    if (_registeredUserId == null ||
        _registering ||
        Firebase.apps.isEmpty ||
        !_isSupportedPlatform) {
      return;
    }
    final userId = _registeredUserId;
    if (!_canNavigate) {
      _registrationDeferred = true;
      return;
    }
    _registrationDeferred = false;
    _registering = true;
    try {
      final storage = ref.read(secureStorageProvider);
      final service = PushDeviceService(ref.read(dioProvider), storage);
      final status = await service.authorizationStatus();
      if (status != AuthorizationStatus.authorized &&
          status != AuthorizationStatus.provisional) {
        if (await storage.wasPushPermissionExplained()) return;
        if (_registeredUserId != userId) return;
        if (!_canNavigate) {
          _registrationDeferred = true;
          return;
        }
        final dialogContext =
            widget.router.routerDelegate.navigatorKey.currentContext;
        if (dialogContext == null || !dialogContext.mounted) return;
        final allow = await showDialog<bool>(
          context: dialogContext,
          builder: (context) => AlertDialog(
            title: const Text('Nhận thông báo từ Lambe?'),
            content: const Text(
              'Lambe sẽ báo khi có lịch hẹn mới, thay đổi đơn hàng hoặc tin nhắn, kể cả khi bạn không mở ứng dụng.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text('Để sau'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Bật thông báo'),
              ),
            ],
          ),
        );
        if (!mounted || _registeredUserId != userId) return;
        await storage.markPushPermissionExplained();
        if (allow != true) return;
      }
      if (_registeredUserId != userId) return;
      if (!_canNavigate) {
        _registrationDeferred = true;
        return;
      }
      await service.register();
    } catch (error) {
      debugPrint('Push registration unavailable: $error');
    } finally {
      _registering = false;
    }
  }

  Future<void> _registerToken(String token) async {
    if (_registeredUserId == null || !_isSupportedPlatform) {
      return;
    }
    try {
      final service = PushDeviceService(
        ref.read(dioProvider),
        ref.read(secureStorageProvider),
      );
      final status = await service.authorizationStatus();
      if (status == AuthorizationStatus.authorized ||
          status == AuthorizationStatus.provisional) {
        await service.registerToken(token);
      }
    } catch (error) {
      debugPrint('Push token update unavailable: $error');
    }
  }

  void _refreshOnMessage(RemoteMessage message) {
    final user = ref.read(authNotifierProvider).valueOrNull;
    if (user == null) return;
    final data = message.data;
    if (data['entityType'] == 'ORDER') {
      ref.invalidate(orderNotificationsProvider(user.id));
      ref.invalidate(notificationsNotifierProvider(user.id));
      final orderId = data['entityId'];
      if (orderId is String &&
          RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(orderId)) {
        if (data['recipientRole'] == 'PROVIDER' &&
            user.roles.contains('PROVIDER') &&
            ref.exists(providerOrderExecutionNotifierProvider(orderId))) {
          unawaited(
            ref
                .read(providerOrderExecutionNotifierProvider(orderId).notifier)
                .fetchDetail(silent: true, queueIfBusy: true),
          );
        } else if (data['recipientRole'] == 'CUSTOMER' &&
            ref.exists(customerOrderDetailNotifierProvider(orderId))) {
          unawaited(
            ref
                .read(customerOrderDetailNotifierProvider(orderId).notifier)
                .fetchOrder(silent: true, queueIfBusy: true),
          );
        }
      }
      if (data['recipientRole'] == 'PROVIDER' &&
          ref.exists(providerOrdersListProvider)) {
        ref.invalidate(providerOrdersListProvider);
      } else if (data['recipientRole'] == 'CUSTOMER') {
        ref.invalidate(customerOrdersListProvider);
      }
    } else if (data['entityType'] == 'CHAT') {
      final view = data['recipientRole'] == 'PROVIDER'
          ? 'provider'
          : 'customer';
      if (ref.exists(chatInboxNotifierProvider(view))) {
        unawaited(
          ref
              .read(chatInboxNotifierProvider(view).notifier)
              .fetchInbox(silent: true),
        );
      }
    }
  }

  void _openMessage(RemoteMessage message) {
    _pendingOpen = message;
    _schedulePendingNavigation();
  }

  // Auth can finish before splash's GPS/mode checks. Wait for its landing route
  // to be committed so splash cannot replace the notification destination.
  bool get _canNavigate {
    final auth = ref.read(authNotifierProvider);
    return !auth.isLoading &&
        auth.valueOrNull != null &&
        isAppContentReady(widget.router);
  }

  void _schedulePendingNavigation() {
    if (!mounted ||
        (_pendingOpen == null && !_registrationDeferred) ||
        _navigationScheduled) {
      return;
    }
    _navigationScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _navigationScheduled = false;
      if (!mounted || !_canNavigate) return;
      unawaited(_navigatePending());
      if (_registrationDeferred) unawaited(_register());
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  Future<void> _navigatePending() async {
    if (!_canNavigate) return;
    final message = _pendingOpen;
    final user = ref.read(authNotifierProvider).valueOrNull;
    if (message == null || user == null) return;
    _pendingOpen = null;
    final type = message.data['entityType'];
    final id = message.data['entityId'];
    final role = message.data['recipientRole'];
    if (id is! String || !RegExp(r'^[a-fA-F0-9-]{36}$').hasMatch(id)) return;
    if (role == 'PROVIDER' &&
        type != 'FEED_NOTICE' &&
        !user.roles.contains('PROVIDER')) {
      return;
    }
    if (role != 'PROVIDER' && role != 'CUSTOMER') return;
    if (!mounted || ref.read(authNotifierProvider).valueOrNull?.id != user.id) {
      return;
    }
    if (type == 'ORDER') {
      try {
        final destination = await ref
            .read(notificationsRepositoryProvider)
            .resolveDestination(
              AppNotificationEntity(
                id: message.data['notificationId'] ?? '',
                title: '',
                body: '',
                category: NotificationCategory.order,
                createdAt: DateTime.now(),
                metadata: {
                  'entityType': 'ORDER',
                  'orderId': id,
                  'recipientRole': role,
                },
              ),
            );
        if (mounted &&
            ref.read(authNotifierProvider).valueOrNull?.id == user.id &&
            destination != null) {
          if (!_canNavigate) {
            _pendingOpen ??= message;
            return;
          }
          _refreshOnMessage(message);
          widget.router.push(destination);
        }
      } catch (_) {
        final targetContext =
            widget.router.routerDelegate.navigatorKey.currentContext;
        if (mounted &&
            ref.read(authNotifierProvider).valueOrNull?.id == user.id &&
            _canNavigate &&
            targetContext != null &&
            targetContext.mounted) {
          await AppDialog.error(
            targetContext,
            message: 'Chưa mở được đơn từ thông báo. Vui lòng kiểm tra lại trong danh sách đơn.',
          );
        }
      }
    } else if (type == 'CHAT') {
      widget.router.push('/chat/room?conversationId=$id');
    } else if (type == 'APPLICATION') {
      try {
        await ref
            .read(partnerNotifierProvider.notifier)
            .loadLatestApplication();
        await ref.read(authNotifierProvider.notifier).refreshSession();
      } catch (err) {
        debugPrint('Unable to refresh provider application session: $err');
      }
      if (!mounted) return;
      final latest = ref.read(authNotifierProvider).valueOrNull;
      if (latest?.id == user.id) {
        widget.router.push(
          latest!.roles.contains('PROVIDER')
              ? '/provider/home'
              : '/partner/status',
        );
      }
    } else if (type == 'FEED_NOTICE') {
      widget.router.push('/feed?notices=true');
    } else if (type == 'SERVICE_CHANGE' && role == 'PROVIDER') {
      widget.router.push('/provider/account');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authNotifierProvider);
    final userId = auth.valueOrNull?.id;
    if (auth.hasValue && userId != _registeredUserId) {
      _registeredUserId = userId;
      if (userId != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          unawaited(_register());
        });
      } else {
        _pendingOpen = null;
      }
    }
    _schedulePendingNavigation();
    return widget.child;
  }

  @override
  void didUpdateWidget(covariant PushNotificationCoordinator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.router != widget.router) {
      oldWidget.router.routerDelegate.removeListener(
        _schedulePendingNavigation,
      );
      widget.router.routerDelegate.addListener(_schedulePendingNavigation);
      _schedulePendingNavigation();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.router.routerDelegate.removeListener(_schedulePendingNavigation);
    _foreground?.cancel();
    _opened?.cancel();
    _tokenRefresh?.cancel();
    super.dispose();
  }
}

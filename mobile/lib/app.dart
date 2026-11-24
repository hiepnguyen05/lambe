import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/core/routing/app_router.dart';
import 'package:mobile/features/shared/order_notifications/presentation/order_notification_coordinator.dart';
import 'package:mobile/features/shared/notifications/presentation/push_notification_coordinator.dart';

class LambeApp extends ConsumerStatefulWidget {
  const LambeApp({super.key});

  @override
  ConsumerState<LambeApp> createState() => _LambeAppState();
}

class _LambeAppState extends ConsumerState<LambeApp> {
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  Widget build(BuildContext context) {
    final goRouter = ref.watch(goRouterProvider);

    return MaterialApp.router(
      title: 'Lambe Beauty',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      routerConfig: goRouter,
      scaffoldMessengerKey: _messengerKey,
      builder: (context, child) => PushNotificationCoordinator(
        router: goRouter,
        messengerKey: _messengerKey,
        child: OrderNotificationCoordinator(
          router: goRouter,
          messengerKey: _messengerKey,
          child: child ?? const SizedBox.shrink(),
        ),
      ),
    );
  }
}

import 'package:go_router/go_router.dart';

/// Notification UI waits until startup and authentication routes have finished.
bool isAppContentReady(GoRouter router) {
  if (router.routerDelegate.currentConfiguration.isEmpty) return false;
  final path = router.state.uri.path;
  return path != '/splash' &&
      path != '/onboarding' &&
      path != '/auth' &&
      !path.startsWith('/auth/');
}

import 'package:mobile/features/shared/auth/domain/entities/user_entity.dart';

enum AppMode { customer, provider }

String signedInLandingRoute(UserEntity user, AppMode mode) {
  if (mode == AppMode.provider && user.roles.contains('PROVIDER')) {
    return '/provider/home';
  }
  if (user.onboardingStatus != 'COMPLETED' &&
      user.onboardingStatus != 'SKIPPED') {
    return '/onboarding';
  }
  return '/home';
}

String? signedInRedirect(UserEntity user, AppMode mode, String location) {
  final landing = signedInLandingRoute(user, mode);
  if (landing == '/onboarding') {
    return location == landing ? null : landing;
  }
  if (location == '/auth' ||
      location.startsWith('/auth/') ||
      location == '/onboarding') {
    return landing;
  }
  if (!user.roles.contains('PROVIDER') &&
      (location == '/provider' || location.startsWith('/provider/'))) {
    return '/home';
  }
  if (user.roles.contains('PROVIDER') &&
      (location == '/partner/submit' || location == '/partner/status')) {
    return landing;
  }
  // Mode chooses the landing page; role still controls access to provider routes.
  return null;
}

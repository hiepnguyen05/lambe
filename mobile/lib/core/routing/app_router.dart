import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/address/domain/entities/address_entity.dart';
import '../../features/address/presentation/screens/address_list_screen.dart';
import '../../features/address/presentation/screens/edit_address_screen.dart';
import '../../features/auth/domain/entities/user_entity.dart';
import '../../features/auth/di/auth_providers.dart';
import '../../features/auth/presentation/screens/auth_screen.dart';
import '../../features/auth/presentation/screens/complete_registration_screen.dart';
import '../../features/auth/presentation/screens/link_phone_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/onboarding/presentation/screens/onboarding_screen.dart';
import '../../features/partner/presentation/screens/partner_expertise_screen.dart';
import '../../features/partner/presentation/screens/partner_identity_screen.dart';
import '../../features/partner/presentation/screens/partner_info_screen.dart';
import '../../features/partner/presentation/screens/partner_intro_screen.dart';
import '../../features/partner/presentation/screens/partner_services_screen.dart';
import '../../features/partner/presentation/screens/partner_status_screen.dart';
import '../../features/partner/presentation/screens/partner_submit_screen.dart';
import '../../features/partner/presentation/screens/partner_type_screen.dart';
import '../../features/profile/presentation/screens/edit_profile_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import 'page_transitions.dart';

final goRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final auth = ref.read(authNotifierProvider);
      if (auth.isLoading || auth.hasError) {
        return null;
      }

      final user = auth.value;
      final location = state.matchedLocation;
      final isAuthRoute = location == '/auth' || location.startsWith('/auth/');
      final isOnboarding = location == '/onboarding';
      final isSplash = location == '/splash';

      if (user == null) {
        return isAuthRoute ? null : '/auth';
      }

      final hasFinishedOnboarding =
          user.onboardingStatus == 'COMPLETED' ||
          user.onboardingStatus == 'SKIPPED';

      if (!hasFinishedOnboarding) {
        return isOnboarding ? null : '/onboarding';
      }

      if (isSplash || isAuthRoute || isOnboarding) {
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const _SessionGateScreen(),
      ),
      GoRoute(path: '/auth', builder: (context, state) => const AuthScreen()),
      GoRoute(
        path: '/auth/otp',
        pageBuilder: (context, state) {
          final extra = state.extra;
          var phone = '';
          var isLinking = false;

          if (extra is String) {
            phone = extra;
          } else if (extra is Map<String, dynamic>) {
            phone = extra['phone'] as String? ?? '';
            isLinking = extra['isLinking'] as bool? ?? false;
          }

          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: OtpScreen(phone: phone, isLinking: isLinking),
          );
        },
      ),
      GoRoute(
        path: '/auth/link-phone',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const LinkPhoneScreen(),
        ),
      ),
      GoRoute(
        path: '/auth/complete-registration',
        pageBuilder: (context, state) => PageTransitions.fadeTransition(
          key: state.pageKey,
          child: CompleteRegistrationScreen(
            registrationToken: state.extra as String? ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/onboarding',
        pageBuilder: (context, state) => PageTransitions.fadeTransition(
          key: state.pageKey,
          child: const OnboardingScreen(),
        ),
      ),
      GoRoute(
        path: '/home',
        pageBuilder: (context, state) => PageTransitions.fadeTransition(
          key: state.pageKey,
          child: const HomeScreen(),
        ),
      ),
      GoRoute(
        path: '/profile',
        pageBuilder: (context, state) => PageTransitions.fadeTransition(
          key: state.pageKey,
          child: const ProfileScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/edit',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const EditProfileScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/preferences',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const OnboardingScreen(isEditingPreferences: true),
        ),
      ),
      GoRoute(
        path: '/profile/address',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const AddressListScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/address/create',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const EditAddressScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/address/edit',
        redirect: (context, state) =>
            state.extra is AddressEntity ? null : '/profile/address',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: EditAddressScreen(address: state.extra! as AddressEntity),
        ),
      ),
      GoRoute(
        path: '/partner/intro',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const PartnerIntroScreen(),
        ),
      ),
      GoRoute(
        path: '/partner/type',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const PartnerTypeScreen(),
        ),
      ),
      GoRoute(
        path: '/partner/info',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const PartnerInfoScreen(),
        ),
      ),
      GoRoute(
        path: '/partner/services',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const PartnerServicesScreen(),
        ),
      ),
      GoRoute(
        path: '/partner/identity',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const PartnerIdentityScreen(),
        ),
      ),
      GoRoute(
        path: '/partner/expertise',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const PartnerExpertiseScreen(),
        ),
      ),
      GoRoute(
        path: '/partner/documents',
        redirect: (context, state) => '/partner/identity',
      ),
      GoRoute(
        path: '/partner/submit',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const PartnerSubmitScreen(),
        ),
      ),
      GoRoute(
        path: '/partner/status',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const PartnerStatusScreen(),
        ),
      ),
    ],
  );

  ref.listen<AsyncValue<UserEntity?>>(authNotifierProvider, (_, __) {
    router.refresh();
  });
  ref.onDispose(router.dispose);
  return router;
});

class _SessionGateScreen extends ConsumerWidget {
  const _SessionGateScreen();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authNotifierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FB),
      body: Center(
        child: auth.hasError
            ? Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.cloud_off_outlined,
                      size: 44,
                      color: Color(0xFF0F766E),
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Không thể kiểm tra phiên đăng nhập',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      auth.error.toString(),
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(0xFF6E7977)),
                    ),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: () => ref
                          .read(authNotifierProvider.notifier)
                          .refreshSession(),
                      icon: const Icon(Icons.refresh),
                      label: const Text('Thử lại'),
                    ),
                  ],
                ),
              )
            : const CircularProgressIndicator(color: Color(0xFF0F766E)),
      ),
    );
  }
}

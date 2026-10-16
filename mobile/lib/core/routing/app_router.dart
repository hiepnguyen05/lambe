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
import '../../features/booking/presentation/screens/booking_config_screen.dart';
import '../../features/booking/presentation/screens/booking_confirmation_screen.dart';
import '../../features/booking/presentation/screens/select_provider_screen.dart';
import '../../features/catalog/domain/entities/service_item_entity.dart';
import '../../features/catalog/presentation/screens/service_detail_screen.dart';
import '../../features/catalog/presentation/screens/services_list_screen.dart';
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
import '../../features/provider_workspace/presentation/screens/provider_home_screen.dart';
import '../../features/provider_workspace/presentation/screens/provider_main_screen.dart';
import '../../features/provider_workspace/presentation/screens/placeholders/provider_orders_screen.dart';
import '../../features/provider_workspace/presentation/screens/placeholders/provider_reviews_screen.dart';
import '../../features/provider_workspace/presentation/screens/placeholders/provider_account_screen.dart';
import '../../features/provider_income/presentation/screens/provider_income_screen.dart';
import '../../features/provider_schedule/presentation/screens/provider_schedule_screen.dart';
import '../../features/splash/presentation/screens/splash_screen.dart';
import 'page_transitions.dart';

final goRouterProvider = Provider<GoRouter>((ref) {
  final router = GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final location = state.matchedLocation;
      final isSplash = location == '/splash';

      // 1. Màn hình Splash tự đảm nhiệm kiểm tra phiên, vị trí, vai trò và điều hướng
      if (isSplash) {
        return null;
      }

      final auth = ref.read(authNotifierProvider);
      if (auth.isLoading || auth.hasError) {
        return null;
      }

      final user = auth.value;
      final isAuthRoute = location == '/auth' || location.startsWith('/auth/');
      final isOnboarding = location == '/onboarding';

      if (user == null) {
        return isAuthRoute ? null : '/auth';
      }

      final hasFinishedOnboarding =
          user.onboardingStatus == 'COMPLETED' ||
          user.onboardingStatus == 'SKIPPED';

      if (!hasFinishedOnboarding) {
        return isOnboarding ? null : '/onboarding';
      }

      if (isAuthRoute || isOnboarding) {
        if (user.roles.contains('PROVIDER')) {
          return '/provider/home';
        }
        return '/home';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
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
        path: '/services',
        pageBuilder: (context, state) {
          final categorySlug = state.uri.queryParameters['categorySlug'];
          final categoryName = state.uri.queryParameters['categoryName'];
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: ServicesListScreen(
              initialCategorySlug: categorySlug,
              initialCategoryName: categoryName,
            ),
          );
        },
      ),
      GoRoute(
        path: '/services/detail',
        pageBuilder: (context, state) {
          final service = state.extra as ServiceItemEntity?;
          final slug = state.uri.queryParameters['slug'] ?? service?.slug ?? '';
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: ServiceDetailScreen(
              initialService: service,
              serviceSlug: slug,
            ),
          );
        },
      ),
      GoRoute(
        path: '/booking/config',
        pageBuilder: (context, state) {
          final service = state.extra as ServiceItemEntity?;
          if (service == null) {
            return PageTransitions.slideRightToLeft(
              key: state.pageKey,
              child: const Scaffold(
                body: Center(child: Text('Không tìm thấy thông tin dịch vụ')),
              ),
            );
          }
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: BookingConfigScreen(service: service),
          );
        },
      ),
      GoRoute(
        path: '/booking/providers',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const SelectProviderScreen(),
        ),
      ),
      GoRoute(
        path: '/booking/confirm',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const BookingConfirmationScreen(),
        ),
      ),
      GoRoute(
        path: '/provider',
        redirect: (context, state) => '/provider/home',
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return ProviderMainScreen(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/provider/home',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const ProviderHomeScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/provider/orders',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const ProviderOrdersScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/provider/income',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const ProviderIncomeScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/provider/reviews',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const ProviderReviewsScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/provider/account',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const ProviderAccountScreen(),
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/provider/schedule',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const ProviderScheduleScreen(),
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

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'app_route_observer.dart';

import 'package:mobile/features/customer/ai_consultation/presentation/screens/ai_consultation_screen.dart';
import 'package:mobile/features/customer/ai_consultation/presentation/screens/ai_inspiration_post_screen.dart';

import 'package:mobile/features/shared/address/domain/entities/address_entity.dart';
import 'package:mobile/features/shared/address/presentation/screens/address_list_screen.dart';
import 'package:mobile/features/shared/address/presentation/screens/edit_address_screen.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/provider/location/di/provider_location_providers.dart';
import 'package:mobile/features/shared/auth/presentation/screens/auth_screen.dart';
import 'package:mobile/features/shared/auth/presentation/screens/complete_registration_screen.dart';
import 'package:mobile/features/shared/auth/presentation/screens/link_phone_screen.dart';
import 'package:mobile/features/shared/auth/presentation/screens/otp_screen.dart';
import 'package:mobile/features/customer/booking/presentation/screens/booking_config_screen.dart';
import 'package:mobile/features/customer/booking/domain/entities/provider_booking_entry.dart';
import 'package:mobile/features/customer/booking/presentation/screens/booking_confirmation_screen.dart';
import 'package:mobile/features/customer/booking/presentation/screens/booking_awaiting_response_screen.dart';
import 'package:mobile/features/customer/booking/presentation/screens/select_provider_screen.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';
import 'package:mobile/features/customer/catalog/presentation/screens/service_detail_screen.dart';
import 'package:mobile/features/customer/catalog/presentation/screens/category_services_screen.dart';
import 'package:mobile/features/customer/home/presentation/screens/customer_main_screen.dart';
import 'package:mobile/features/customer/home/presentation/screens/home_screen.dart';
import 'package:mobile/features/customer/onboarding/presentation/screens/onboarding_screen.dart';
import 'package:mobile/features/shared/notifications/presentation/screens/notifications_screen.dart';
import 'package:mobile/features/provider/registration/presentation/screens/partner_expertise_screen.dart';
import 'package:mobile/features/provider/registration/presentation/screens/partner_identity_screen.dart';
import 'package:mobile/features/provider/registration/presentation/screens/partner_info_screen.dart';
import 'package:mobile/features/provider/registration/presentation/screens/partner_intro_screen.dart';
import 'package:mobile/features/provider/registration/presentation/screens/partner_services_screen.dart';
import 'package:mobile/features/provider/registration/presentation/screens/partner_status_screen.dart';
import 'package:mobile/features/provider/registration/presentation/screens/partner_submit_screen.dart';
import 'package:mobile/features/provider/registration/presentation/screens/partner_type_screen.dart';
import 'package:mobile/features/shared/profile/presentation/screens/edit_profile_screen.dart';
import 'package:mobile/features/customer/orders/presentation/screens/customer_appointments_screen.dart';
import 'package:mobile/features/customer/orders/presentation/screens/customer_order_detail_screen.dart';
import 'package:mobile/features/customer/orders/presentation/screens/customer_order_tracking_screen.dart';
import 'package:mobile/features/provider/workspace/presentation/screens/provider_orders_list_screen.dart';
import 'package:mobile/features/provider/workspace/presentation/screens/provider_order_execution_screen.dart';
import 'package:mobile/features/provider/workspace/presentation/screens/provider_home_screen.dart';
import 'package:mobile/features/provider/workspace/presentation/screens/provider_main_screen.dart';
import 'package:mobile/features/provider/income/presentation/screens/provider_income_screen.dart';
import 'package:mobile/features/provider/schedule/presentation/screens/provider_schedule_screen.dart';
import 'package:mobile/features/provider/workspace/presentation/screens/provider_vouchers_screen.dart';
import 'package:mobile/features/provider/workspace/presentation/screens/provider_reviews_screen.dart';
import 'package:mobile/features/shared/profile/presentation/screens/partner_profile_screen.dart';
import 'package:mobile/features/shared/profile/presentation/screens/partner_public_profile_screen.dart';
import 'package:mobile/features/shared/splash/presentation/screens/splash_screen.dart';
import 'package:mobile/features/shared/chat/domain/entities/chat_peer_entity.dart';
import 'package:mobile/features/shared/chat/presentation/screens/chat_inbox_screen.dart';
import 'package:mobile/features/shared/chat/presentation/screens/chat_room_screen.dart';
import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/features/provider/services/presentation/screens/provider_services_screen.dart';
import 'package:mobile/features/provider/services/presentation/screens/provider_service_detail_screen.dart';
import 'package:mobile/features/provider/services/presentation/screens/service_change_editor_screen.dart';
import 'package:mobile/features/provider/services/presentation/screens/service_change_detail_screen.dart';
import 'package:mobile/core/routing/page_transitions.dart';
import 'package:mobile/features/shared/beauty_feed/domain/feed_scope.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/screens/feed_screen.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/screens/feed_post_screen.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/screens/feed_composer_screen.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/screens/feed_comments_screen.dart';
import 'package:mobile/features/shared/beauty_feed/presentation/screens/feed_video_screen.dart';

import 'app_mode.dart';
import 'app_mode_provider.dart';

import 'package:mobile/features/provider/members/presentation/screens/provider_members_list_screen.dart';
import 'package:mobile/features/provider/members/presentation/screens/provider_invitations_screen.dart';
import 'package:mobile/features/provider/members/presentation/screens/provider_member_detail_screen.dart';
import 'package:mobile/features/provider/members/presentation/screens/member_services_assignment_screen.dart';
import 'package:mobile/features/provider/members/presentation/screens/member_schedule_management_screen.dart';
import 'package:mobile/features/provider/members/presentation/screens/organization_feed_review_screen.dart';
import 'package:mobile/features/provider/members/presentation/screens/worker_cash_collections_screen.dart';
import 'package:mobile/features/provider/members/presentation/screens/worker_time_off_screen.dart';
import 'package:mobile/features/provider/members/domain/entities/provider_member_entity.dart';
import 'package:mobile/features/shared/invitations/presentation/screens/my_invitations_screen.dart';
import 'package:mobile/features/shared/invitations/presentation/screens/invitation_detail_screen.dart';
import 'package:mobile/features/shared/invitations/domain/entities/received_invitation_entity.dart';
import 'package:mobile/features/provider/member_verification/presentation/screens/member_verification_status_screen.dart';
import 'package:mobile/features/provider/member_verification/presentation/screens/member_verification_form_screen.dart';
import 'package:mobile/features/provider/member_verification/presentation/screens/member_verification_docs_screen.dart';
import 'package:mobile/features/provider/member_verification/domain/entities/member_verification_entity.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>();

class GoRouterAuthRefreshNotifier extends ChangeNotifier {
  GoRouterAuthRefreshNotifier(Ref ref) {
    ref.listen(authNotifierProvider, (previous, next) {
      if (previous?.valueOrNull != next.valueOrNull) {
        notifyListeners();
      }
    });
    ref.listen<int>(sessionExpiredSignalProvider, (previous, next) {
      if (next > 0) {
        if (ref
                .read(authNotifierProvider)
                .valueOrNull
                ?.roles
                .contains('PROVIDER') ==
            true) {
          unawaited(ref.read(providerLocationCoordinatorProvider).stopAll());
        }
        ref.read(authNotifierProvider.notifier).expireSession();
        notifyListeners();
      }
    });
  }
}

final goRouterProvider = Provider<GoRouter>((ref) {
  final refreshListenable = GoRouterAuthRefreshNotifier(ref);
  ref.onDispose(refreshListenable.dispose);

  final router = GoRouter(
    navigatorKey: rootNavigatorKey,
    observers: [appRouteObserver],
    initialLocation: '/splash',
    refreshListenable: refreshListenable,
    redirect: (context, state) async {
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

      final user = auth.valueOrNull;
      final isAuthRoute = location == '/auth' || location.startsWith('/auth/');

      if (user == null) {
        return isAuthRoute ? null : '/auth';
      }

      final mode = await ref.read(appModeProvider(user.id).future);
      if (ref.read(authNotifierProvider).valueOrNull?.id != user.id) {
        return '/auth';
      }
      return signedInRedirect(user, mode, location);
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/auth',
        pageBuilder: (context, state) => PageTransitions.fadeTransition(
          key: state.pageKey,
          child: const AuthScreen(),
        ),
      ),
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
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) {
          return CustomerMainScreen(navigationShell: navigationShell);
        },
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const HomeScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/appointments',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const CustomerAppointmentsScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/explore',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const FeedScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/messages',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const ChatInboxScreen(view: 'customer'),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const PartnerProfileScreen(),
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/ai-consultation',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: AiConsultationScreen(initialPrompt: state.extra as String?),
        ),
      ),
      GoRoute(
        path: '/feed',
        builder: (context, state) => FeedScreen(
          showNotices:state.uri.queryParameters['notices']=='true',
          initialMode: FeedMode.values.firstWhere(
            (v) => v.name == state.uri.queryParameters['mode'],
            orElse: () => FeedMode.all,
          ),
          providerId: state.uri.queryParameters['providerId'],
          serviceId: state.uri.queryParameters['serviceId'],
        ),
      ),
      GoRoute(
        path: '/feed/compose',
        builder: (context, state) => const FeedComposerScreen(),
      ),
      GoRoute(
        path: '/feed/posts/:id',
        builder: (context, state) => FeedPostScreen(
          id: state.pathParameters['id']!,
          manage: state.uri.queryParameters['manage'] == 'true',
        ),
      ),
      GoRoute(
        path: '/feed/posts/:id/edit',
        builder: (context, state) =>
            FeedComposerScreen(postId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/feed/posts/:id/comments',
        builder: (context, state) =>
            FeedCommentsScreen(postId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/feed/posts/:id/media/:mediaId',
        builder: (context, state) => FeedVideoScreen(
          postId: state.pathParameters['id']!,
          mediaId: state.pathParameters['mediaId']!,
          manage: state.uri.queryParameters['manage'] == 'true',
        ),
      ),
      GoRoute(
        path: '/inspiration/posts/:id',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: AiInspirationPostScreen(
            postId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/services',
        pageBuilder: (context, state) {
          final categorySlug = state.uri.queryParameters['categorySlug'];
          final categoryName = state.uri.queryParameters['categoryName'];
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: CategoryServicesScreen(
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
          final entry = state.extra;
          final providerEntry = entry is ProviderBookingEntry ? entry : null;
          final service = entry is ServiceItemEntity
              ? entry
              : providerEntry?.service;
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
            child: BookingConfigScreen(
              service: service,
              initialProvider: providerEntry,
            ),
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
        path: '/booking/waiting/:id',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: BookingAwaitingResponseScreen(
            orderId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/notifications',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const NotificationsScreen(),
        ),
      ),
      GoRoute(
        path: '/appointments/:id',
        pageBuilder: (context, state) {
          final orderId = state.pathParameters['id'] ?? '';
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: CustomerOrderDetailScreen(orderId: orderId),
          );
        },
      ),
      GoRoute(
        path: '/appointments/:id/tracking',
        pageBuilder: (context, state) {
          final orderId = state.pathParameters['id'] ?? '';
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: CustomerOrderTrackingScreen(orderId: orderId),
          );
        },
      ),
      GoRoute(
        path: '/provider/orders/:id',
        pageBuilder: (context, state) {
          final orderId = state.pathParameters['id'] ?? '';
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: ProviderOrderExecutionScreen(orderId: orderId),
          );
        },
      ),
      GoRoute(
        path: '/provider/vouchers',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const ProviderVouchersScreen(),
        ),
      ),
      GoRoute(
        path: '/provider/services',
        builder: (_, state) => ProviderServicesScreen(
          initialTab: state.uri.queryParameters['tab'] == 'changes' ? 1 : 0,
        ),
      ),
      GoRoute(
        path: '/provider/services/:id',
        builder: (_, state) =>
            ProviderServiceDetailScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/provider/service-changes/new',
        builder: (_, state) => ServiceChangeEditorScreen(
          offeringId: state.uri.queryParameters['offeringId'],
        ),
      ),
      GoRoute(
        path: '/provider/service-changes/:id/edit',
        builder: (_, state) =>
            ServiceChangeEditorScreen(requestId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/provider/service-changes/:id',
        builder: (_, state) =>
            ServiceChangeDetailScreen(id: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/chat/room',
        pageBuilder: (context, state) {
          final extra = state.extra;
          String? conversationId = state.uri.queryParameters['conversationId'];
          String? providerId = state.uri.queryParameters['providerId'];
          String? initialText;
          ChatPeerEntity? peer;

          if (extra is Map<String, dynamic>) {
            conversationId =
                extra['conversationId'] as String? ?? conversationId;
            providerId = extra['providerId'] as String? ?? providerId;
            initialText = extra['initialText'] as String?;
            peer = extra['peer'] as ChatPeerEntity?;
          } else if (extra is ChatPeerEntity) {
            peer = extra;
          }

          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: ChatRoomScreen(
              conversationId: conversationId,
              providerId: providerId,
              peer: peer,
              initialText: initialText,
            ),
          );
        },
      ),
      GoRoute(
        path: '/provider/messages',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const ChatInboxScreen(view: 'provider'),
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
                  child: const ProviderOrdersListScreen(),
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/provider/explore',
                pageBuilder: (context, state) => PageTransitions.fadeTransition(
                  key: state.pageKey,
                  child: const FeedScreen(),
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
                  child: const PartnerProfileScreen(),
                ),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/provider/feed',
        redirect: (context, state) => '/provider/explore',
      ),
      GoRoute(
        path: '/provider/profile',
        redirect: (context, state) => '/provider/account',
      ),
      GoRoute(
        path: '/partner/profile',
        redirect: (context, state) => '/provider/account',
      ),
      GoRoute(
        path: '/providers/:id/public',
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: PartnerPublicProfileScreen(providerId: id),
          );
        },
      ),
      GoRoute(
        path: '/partner/public/:id',
        redirect: (context, state) =>
            '/providers/${state.pathParameters['id']}/public',
      ),
      GoRoute(
        path: '/provider/schedule',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const ProviderScheduleScreen(),
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
      GoRoute(
        path: '/provider/members',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const ProviderMembersListScreen(),
        ),
      ),
      GoRoute(
        path: '/provider/members/:id',
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          final extra = state.extra is ProviderMemberEntity
              ? state.extra! as ProviderMemberEntity
              : null;
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: ProviderMemberDetailScreen(
              memberId: id,
              initialMember: extra,
            ),
          );
        },
      ),
      GoRoute(
        path: '/provider/members/:id/services',
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          final memberName = state.extra is String ? state.extra as String : null;
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: MemberServicesAssignmentScreen(
              memberId: id,
              memberName: memberName,
            ),
          );
        },
      ),
      GoRoute(
        path: '/provider/members/:id/schedule',
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          final memberName = state.extra is String ? state.extra as String : null;
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: MemberScheduleManagementScreen(
              memberId: id,
              memberName: memberName,
            ),
          );
        },
      ),
      GoRoute(
        path: '/provider/feed-review',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const OrganizationFeedReviewScreen(),
        ),
      ),
      GoRoute(
        path: '/provider/worker/schedule',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const WorkerTimeOffScreen(),
        ),
      ),
      GoRoute(
        path: '/provider/worker/collections',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const WorkerCashCollectionsScreen(),
        ),
      ),
      GoRoute(
        path: '/provider/invitations',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const ProviderInvitationsScreen(),
        ),
      ),
      GoRoute(
        path: '/profile/invitations',
        pageBuilder: (context, state) => PageTransitions.slideRightToLeft(
          key: state.pageKey,
          child: const MyInvitationsScreen(),
        ),
      ),
      GoRoute(
        path: '/invitations/:id',
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          final extra = state.extra is ReceivedInvitationEntity
              ? state.extra! as ReceivedInvitationEntity
              : null;
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: InvitationDetailScreen(
              invitationId: id,
              initialInvitation: extra,
            ),
          );
        },
      ),
      GoRoute(
        path: '/provider/memberships/:memberId/verification/status',
        pageBuilder: (context, state) {
          final memberId = state.pathParameters['memberId'] ?? '';
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: MemberVerificationStatusScreen(memberId: memberId),
          );
        },
      ),
      GoRoute(
        path: '/provider/memberships/:memberId/verification/form',
        pageBuilder: (context, state) {
          final memberId = state.pathParameters['memberId'] ?? '';
          final extra = state.extra is MemberVerificationProfileEntity
              ? state.extra! as MemberVerificationProfileEntity
              : null;
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: MemberVerificationFormScreen(
              memberId: memberId,
              initialProfile: extra,
            ),
          );
        },
      ),
      GoRoute(
        path: '/provider/memberships/:memberId/verification/documents',
        pageBuilder: (context, state) {
          final memberId = state.pathParameters['memberId'] ?? '';
          return PageTransitions.slideRightToLeft(
            key: state.pageKey,
            child: MemberVerificationDocsScreen(memberId: memberId),
          );
        },
      ),
    ],
  );

  ref.onDispose(router.dispose);
  return router;
});

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/catalog_providers.dart';
import 'package:mobile/features/customer/booking/domain/entities/provider_booking_entry.dart';

import '../../di/partner_profile_providers.dart';
import '../../domain/entities/partner_public_profile_entity.dart';
import '../widgets/public_profile/public_profile_about_tab.dart';
import '../widgets/public_profile/public_profile_hero_card.dart';
import '../widgets/public_profile/public_profile_portfolio_tab.dart';
import '../widgets/public_profile/public_profile_reviews_tab.dart';
import '../widgets/public_profile/public_profile_tabs.dart';
import '../widgets/public_profile/public_profile_team_tab.dart';
import 'package:mobile/features/customer/booking/domain/entities/public_specialist_entity.dart';
import 'package:mobile/features/customer/booking/presentation/providers/public_members_provider.dart';

class PartnerPublicProfileScreen extends ConsumerStatefulWidget {
  final String providerId;

  const PartnerPublicProfileScreen({super.key, required this.providerId});

  @override
  ConsumerState<PartnerPublicProfileScreen> createState() =>
      _PartnerPublicProfileScreenState();
}

class _PartnerPublicProfileScreenState
    extends ConsumerState<PartnerPublicProfileScreen> {
  int _selectedTabIndex = 0;
  bool _startingBooking = false;

  Future<void> _handleSelectService(
    PartnerPublicProfileEntity profile,
    PublicServiceItemEntity service, {
    PublicSpecialistEntity? assignedMember,
  }) async {
    if (_startingBooking) return;
    setState(() => _startingBooking = true);
    try {
      final catalogService = await ref
          .read(catalogRepositoryProvider)
          .getServiceBySlug(service.slug);
      if (!mounted) return;
      await context.push(
        '/booking/config',
        extra: ProviderBookingEntry(
          service: catalogService,
          providerId: profile.id,
          providerServiceId: service.id,
          providerDisplayName: profile.displayName,
          providerAvatarUrl: profile.avatarUrl,
          priceAmount: service.priceAmount,
          assignedMemberId: assignedMember?.id,
          assignedMemberName: assignedMember?.displayName,
        ),
      );
    } catch (_) {
      if (mounted) {
        AppDialog.error(
          context,
          message: 'Không thể mở dịch vụ này. Vui lòng tải lại hồ sơ.',
        );
      }
    } finally {
      if (mounted) setState(() => _startingBooking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final publicProfileAsync = ref.watch(
      publicPartnerProfileProvider(widget.providerId),
    );

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surface.withValues(alpha: 0.95),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        actions: [
          IconButton(
            tooltip: 'Beauty Feed của chuyên viên',
            icon: const Icon(Icons.photo_library_outlined),
            onPressed: () =>
                context.push('/feed?providerId=${widget.providerId}'),
          ),
        ],
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_rounded,
            color: AppColors.onSurface,
          ),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/home');
            }
          },
          tooltip: 'Quay lại',
        ),
        title: const Text(
          'Hồ Sơ Chuyên Gia',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.onSurface,
          ),
        ),
      ),
      body: publicProfileAsync.when(
        loading: () => const Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
              ),
              SizedBox(height: 16),
              Text(
                'Đang tải hồ sơ chuyên gia...',
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: AppColors.error,
                ),
                const SizedBox(height: 12),
                const Text(
                  'Không thể tải hồ sơ đối tác',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  error.toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () {
                    ref.invalidate(
                      publicPartnerProfileProvider(widget.providerId),
                    );
                  },
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Thử lại'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        data: (profile) => _buildContent(profile),
      ),
    );
  }

  Widget _buildContent(PartnerPublicProfileEntity profile) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Profile Header Hero Card
              PublicProfileHeroCard(
                profile: profile,
                onChatTap: () {
                  AppDialog.info(
                    context,
                    title: 'Nhắn tin tư vấn',
                    message:
                        'Kết nối tư vấn nhanh với chuyên viên ${profile.displayName} trước khi tiến hành dịch vụ.',
                    buttonText: 'Đã rõ',
                  );
                },
              ),

              const SizedBox(height: 14),

              // 2. Segmented Navigation Tabs (Giới thiệu | Nhật ký | Đánh giá | Đội ngũ)
              Consumer(
                builder: (context, ref, _) {
                  final membersAsync =
                      ref.watch(publicMembersProvider(profile.id));
                  final hasMembers =
                      membersAsync.valueOrNull?.isNotEmpty == true;

                  return PublicProfileTabs(
                    selectedIndex: _selectedTabIndex,
                    servicesCount: profile.services.length,
                    portfolioCount: profile.portfolio.length,
                    reviewsCount: profile.reviewCount,
                    showTeamTab: hasMembers,
                    onTabSelected: (index) {
                      setState(() {
                        _selectedTabIndex = index;
                      });
                    },
                  );
                },
              ),

              const SizedBox(height: 14),

              // 3. Tab Body
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: _buildSelectedTabBody(profile),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSelectedTabBody(PartnerPublicProfileEntity profile) {
    switch (_selectedTabIndex) {
      case 0:
        return KeyedSubtree(
          key: const ValueKey('tab_about'),
          child: PublicProfileAboutTab(
            profile: profile,
            onSelectService: (service) =>
                _handleSelectService(profile, service),
            onViewAllPortfolio: () {
              setState(() {
                _selectedTabIndex = 1; // Chuyển sang Tab Nhật ký
              });
            },
            onViewAllReviews: () {
              setState(() {
                _selectedTabIndex = 2; // Chuyển sang Tab Đánh giá
              });
            },
          ),
        );
      case 1:
        return KeyedSubtree(
          key: const ValueKey('tab_portfolio'),
          child: PublicProfilePortfolioTab(profile: profile),
        );
      case 2:
        return KeyedSubtree(
          key: const ValueKey('tab_reviews'),
          child: PublicProfileReviewsTab(profile: profile),
        );
      case 3:
        return KeyedSubtree(
          key: const ValueKey('tab_team'),
          child: PublicProfileTeamTab(
            providerId: profile.id,
            onSelectSpecialist: (specialist) {
              if (specialist.services.isNotEmpty) {
                final first = specialist.services.first;
                final pubService = profile.services.firstWhere(
                  (s) => s.id == first.providerServiceId,
                  orElse: () => PublicServiceItemEntity(
                    id: first.providerServiceId,
                    serviceId: first.serviceId,
                    name: first.name,
                    slug: first.serviceId,
                    categoryName: 'Dịch vụ',
                    categorySlug: 'dich-vu',
                    priceAmount: first.priceAmount,
                    durationMinutes: first.durationMinutes,
                  ),
                );
                _handleSelectService(profile, pubService,
                    assignedMember: specialist);
              } else if (profile.services.isNotEmpty) {
                _handleSelectService(profile, profile.services.first,
                    assignedMember: specialist);
              }
            },
          ),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

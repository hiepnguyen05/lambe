import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/location/user_location_provider.dart';
import '../../../address/di/address_providers.dart';
import '../../../auth/di/auth_providers.dart';
import '../providers/home_categories_provider.dart';
import '../widgets/home_chatbot_mascot_fab.dart';
import '../widgets/home_customer_bottom_nav_bar.dart';
import '../widgets/home_featured_specialists_section.dart';
import '../widgets/home_header_app_bar.dart';
import '../widgets/home_hero_banner.dart';
import '../widgets/home_personalization_section.dart';
import '../widgets/home_service_categories_section.dart';
import '../widgets/home_specialist_card.dart';
import '../widgets/home_trust_guarantee_section.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final ScrollController _scrollController = ScrollController();
  int _currentNavIndex = 0;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onBottomNavTapped(int index) {
    if (index == _currentNavIndex) {
      if (index == 0) {
        _scrollController.animateTo(
          0,
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOut,
        );
      }
      return;
    }

    setState(() {
      _currentNavIndex = index;
    });

    switch (index) {
      case 0:
        // Already on home
        break;
      case 1:
        // Lịch hẹn
        _showUnderConstructionModal(
          title: 'Lịch Hẹn Của Bạn',
          description:
              'Bạn chưa có lịch hẹn nào sắp tới. Hãy chọn một dịch vụ làm đẹp tại nhà để đặt lịch ngay nhé!',
        );
        setState(() => _currentNavIndex = 0);
        break;
      case 2:
        // Khám phá
        _scrollController.animateTo(
          480,
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOut,
        );
        setState(() => _currentNavIndex = 0);
        break;
      case 3:
        // Tin nhắn
        _showUnderConstructionModal(
          title: 'Hộp Thoại & Tin Nhắn',
          description:
              'Chức năng trao đổi trực tiếp với chuyên viên sẽ khả dụng ngay khi bạn hoàn tất tạo lịch hẹn.',
        );
        setState(() => _currentNavIndex = 0);
        break;
      case 4:
        // Tài khoản
        context.push('/profile');
        setState(() => _currentNavIndex = 0);
        break;
    }
  }

  void _showUnderConstructionModal({
    required String title,
    required String description,
  }) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primaryContainer.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.calendar_month_rounded,
                size: 28,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              description,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13,
                color: AppColors.onSurfaceVariant,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 44),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
              ),
              child: const Text('Đã hiểu'),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  void _onCategorySelected(HomeCategoryItem category) {
    final encodedName = Uri.encodeComponent(category.name);
    context.push('/services?categorySlug=${category.slug}&categoryName=$encodedName');
  }

  void _onSpecialistSelected(SpecialistItem specialist) {
    _showSpecialistBookingSheet(specialist);
  }

  void _showSpecialistBookingSheet(SpecialistItem specialist) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(22),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundImage: specialist.avatarUrl.isNotEmpty
                      ? CachedNetworkImageProvider(specialist.avatarUrl)
                      : null,
                  backgroundColor: AppColors.surfaceContainer,
                  child: specialist.avatarUrl.isEmpty
                      ? Text(
                          specialist.name.isNotEmpty
                              ? specialist.name[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                            color: AppColors.primary,
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              specialist.name,
                              style: const TextStyle(
                                fontSize: 16.5,
                                fontWeight: FontWeight.bold,
                                color: AppColors.onSurface,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.verified_rounded,
                            size: 17,
                            color: Color(0xFF007DF0),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        specialist.specialty,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: AppColors.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            size: 16,
                            color: Color(0xFFFFB800),
                          ),
                          const SizedBox(width: 2),
                          Text(
                            '${specialist.rating} (${specialist.reviewCount})',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '• ${specialist.distance} • ${specialist.eta}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.outline,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF3FAF9),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: const Color(0xFFCEECE6),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Mức giá dịch vụ khởi điểm:',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppColors.onSurfaceVariant,
                    ),
                  ),
                  Text(
                    '${specialist.startingPrice.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]}.')}₫',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                context.push('/services');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(100),
                ),
              ),
              child: const Text(
                'Xem dịch vụ & đặt lịch',
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  String? _selectedLocationMode;

  void _showLocationSelector() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Consumer(
        builder: (context, ref, _) {
          final liveLocation = ref.watch(userLocationProvider);
          final liveAddresses =
              ref.watch(addressNotifierProvider).valueOrNull ?? [];
          final isGpsActive =
              _selectedLocationMode == 'GPS' || liveAddresses.isEmpty;

          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(context).size.height * 0.75,
            ),
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.outlineVariant,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Địa chỉ nhận dịch vụ',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.onSurface,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Lựa chọn 1: Vị trí GPS hiện tại
                InkWell(
                  onTap: () {
                    setState(() => _selectedLocationMode = 'GPS');
                    Navigator.pop(ctx);
                  },
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isGpsActive
                          ? AppColors.primaryContainer.withValues(alpha: 0.2)
                          : AppColors.surfaceContainerLowest,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isGpsActive
                            ? AppColors.primary
                            : AppColors.outlineVariant.withValues(alpha: 0.5),
                        width: isGpsActive ? 1.5 : 1.0,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.near_me_rounded,
                            color: AppColors.primary,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Text(
                                    'Vị trí GPS hiện tại',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: AppColors.onSurface,
                                    ),
                                  ),
                                  if (isGpsActive) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 1.5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.primary,
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: const Text(
                                        'Đang dùng',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                liveLocation.isLoaded
                                    ? (liveLocation.addressLine.isNotEmpty
                                        ? liveLocation.addressLine
                                        : 'Chưa xác định tọa độ')
                                    : 'Đang định vị GPS...',
                                style: TextStyle(
                                  color: Colors.grey.shade600,
                                  fontSize: 12.5,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.refresh_rounded, size: 20),
                          tooltip: 'Làm mới GPS',
                          color: AppColors.primary,
                          onPressed: () {
                            ref
                                .read(userLocationProvider.notifier)
                                .fetchLocation();
                          },
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Lựa chọn 2: Danh sách địa chỉ đã lưu
                if (liveAddresses.isNotEmpty) ...[
                  const Text(
                    'Địa chỉ đã lưu trong sổ',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Flexible(
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: liveAddresses.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, idx) {
                        final addr = liveAddresses[idx];
                        final isSelected = !isGpsActive && addr.isDefault;

                        return InkWell(
                          onTap: () {
                            setState(() => _selectedLocationMode = null);
                            ref
                                .read(addressNotifierProvider.notifier)
                                .setDefaultAddress(addr.id);
                            Navigator.pop(ctx);
                          },
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.primaryContainer
                                      .withValues(alpha: 0.15)
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.primary
                                    : AppColors.outlineVariant
                                        .withValues(alpha: 0.5),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  addr.type == 'HOME'
                                      ? Icons.home_rounded
                                      : (addr.type == 'WORK'
                                          ? Icons.business_rounded
                                          : Icons.location_on_rounded),
                                  color: isSelected
                                      ? AppColors.primary
                                      : Colors.grey,
                                  size: 20,
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        addr.label ?? 'Địa chỉ',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13.5,
                                          color: isSelected
                                              ? AppColors.primary
                                              : AppColors.onSurface,
                                        ),
                                      ),
                                      Text(
                                        addr.addressLine,
                                        style: TextStyle(
                                          color: Colors.grey.shade600,
                                          fontSize: 12,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                                if (isSelected)
                                  const Icon(
                                    Icons.check_circle_rounded,
                                    color: AppColors.primary,
                                    size: 18,
                                  ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Nút chuyển đến quản lý sổ địa chỉ
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(ctx);
                      context.push('/profile/address');
                    },
                    icon: const Icon(Icons.manage_accounts_outlined, size: 18),
                    label: const Text('Quản lý sổ địa chỉ'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final addresses = ref.watch(addressNotifierProvider).valueOrNull;

    final defaultAddress = (addresses != null && addresses.isNotEmpty)
        ? addresses.firstWhere(
            (a) => a.isDefault,
            orElse: () => addresses.first,
          )
        : null;

    final userLocation = ref.watch(userLocationProvider);
    final isUsingGps = _selectedLocationMode == 'GPS' || defaultAddress == null;

    final locationName = isUsingGps
        ? (userLocation.district ?? 'Vị trí hiện tại')
        : (defaultAddress.label ?? 'Địa chỉ đã lưu');
    final addressLine = isUsingGps
        ? (userLocation.isLoaded ? userLocation.addressLine : 'Đang định vị...')
        : defaultAddress.addressLine;

    final rawName = user?.fullName?.trim();
    final displayName = (rawName != null && rawName.isNotEmpty)
        ? rawName
        : 'Khách yêu';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      body: CustomScrollView(
        controller: _scrollController,
        slivers: [
          // 1. Pinned Header SliverAppBar
          HomeHeaderAppBar(
            locationName: locationName,
            addressLine: addressLine,
            isGps: isUsingGps,
            avatarUrl: user?.avatarUrl,
            onLocationTap: _showLocationSelector,
            onNotificationTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Không có thông báo mới nào.'),
                  duration: Duration(seconds: 2),
                ),
              );
            },
            onProfileTap: () => context.push('/profile'),
          ),

          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverList.list(
              children: [
                const SizedBox(height: 14),

                // Greeting, Search & Filter (kết nối dữ liệu thật, không mock)
                HomePersonalizationSection(
                  userName: displayName,
                  addressLine: addressLine,
                  onlineSpecialistsCount: null, // Không mock số lượng thợ online
                  onLocationTap: _showLocationSelector,
                  onFilterTap: () => context.push('/services'),
                ),
                const SizedBox(height: 18),

                // Hero Promo Banner
                HomeHeroBanner(
                  onBannerTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Mã giảm 20% LAMBEHOME đã sẵn sàng cho đơn đầu tiên của bạn!',
                        ),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 24),

                HomeServiceCategoriesSection(
                  onCategoryTap: _onCategorySelected,
                  onSeeAllTap: () => context.push('/services'),
                ),
                const SizedBox(height: 24),

                // Featured Specialists List
                HomeFeaturedSpecialistsSection(
                  onSpecialistTap: _onSpecialistSelected,
                  onBookTap: _onSpecialistSelected,
                  onSeeMoreTap: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Đang tải thêm danh sách chuyên viên gần bạn...'),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 24),

                // Trust Guarantee (Lambe 3 Standards)
                const HomeTrustGuaranteeSection(),
                const SizedBox(height: 24),

                _buildUtilitiesSection(),
                const SizedBox(height: 100), // Spacing for FAB & Bottom Bar
              ],
            ),
          ),
        ],
      ),

      // 3. Floating 3D AI Mascot FAB at bottom right
      floatingActionButton: const HomeChatbotMascotFab(),

      // 4. Customer Bottom Navigation Bar
      bottomNavigationBar: HomeCustomerBottomNavBar(
        currentIndex: _currentNavIndex,
        onTabSelected: _onBottomNavTapped,
      ),
    );
  }

  Widget _buildUtilitiesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Tiện ích & Cài đặt',
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 16.5,
            color: AppColors.onSurface,
          ),
        ),
        const SizedBox(height: 12),
        _buildUtilityTile(
          icon: Icons.location_on_outlined,
          title: 'Địa chỉ của tôi',
          subtitle: 'Quản lý các địa chỉ nhận dịch vụ làm đẹp',
          onTap: () => context.push('/profile/address'),
        ),
        const SizedBox(height: 10),
        _buildUtilityTile(
          icon: Icons.badge_outlined,
          title: 'Trở thành đối tác chuyên viên Lambe',
          subtitle: 'Gia nhập mạng lưới chuyên viên làm đẹp tại gia',
          onTap: () => context.push('/partner/intro'),
        ),
        const SizedBox(height: 10),
        _buildUtilityTile(
          icon: Icons.person_outline_rounded,
          title: 'Hồ sơ người dùng & Bảo mật',
          subtitle: 'Cập nhật số điện thoại, sở thích và mật khẩu',
          onTap: () => context.push('/profile'),
        ),
      ],
    );
  }

  Widget _buildUtilityTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: const Color(0xFFE2EAF8),
              width: 1,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.primaryContainer.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: AppColors.primary, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: AppColors.outline,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.outline,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

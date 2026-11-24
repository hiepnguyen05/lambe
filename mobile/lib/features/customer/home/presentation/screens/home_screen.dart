import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/location/user_location_provider.dart';
import 'package:mobile/features/shared/address/di/address_providers.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import 'package:mobile/features/customer/discovery/presentation/nearby_providers_section.dart';

import '../providers/home_categories_provider.dart';
import '../widgets/home_chatbot_mascot_fab.dart';
import '../widgets/home_header_app_bar.dart';
import '../widgets/home_location_selector_sheet.dart';
import '../widgets/home_personalization_section.dart';
import '../widgets/home_service_categories_section.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final ScrollController _scrollController = ScrollController();
  String? _selectedLocationMode;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onCategorySelected(HomeCategoryItem category) {
    final encodedName = Uri.encodeComponent(category.name);
    context.push(
      '/services?categorySlug=${category.slug}&categoryName=$encodedName',
    );
  }

  void _showLocationSelector() {
    HomeLocationSelectorSheet.show(
      context,
      selectedLocationMode: _selectedLocationMode,
      onModeChanged: (mode) => setState(() => _selectedLocationMode = mode),
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
    // Luôn ưu tiên mặc định là GPS / Vị trí hiện tại
    final isUsingGps =
        _selectedLocationMode == null || _selectedLocationMode == 'GPS';

    final selectedAddress =
        !isUsingGps && addresses != null && addresses.isNotEmpty
        ? addresses.firstWhere(
            (a) => a.id == _selectedLocationMode,
            orElse: () => defaultAddress ?? addresses.first,
          )
        : null;

    final locationName = isUsingGps
        ? 'Vị trí hiện tại'
        : (selectedAddress?.label ?? 'Địa chỉ đã lưu');
    final addressLine = isUsingGps
        ? (userLocation.isLoaded
              ? (userLocation.addressLine.isNotEmpty
                    ? userLocation.addressLine
                    : (userLocation.district ?? 'Chưa xác định địa chỉ'))
              : 'Đang định vị...')
        : (selectedAddress?.addressLine ?? 'Chưa xác định địa chỉ');

    final rawName = user?.fullName?.trim();
    final displayName = (rawName != null && rawName.isNotEmpty)
        ? rawName
        : 'Quý khách';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: CustomScrollView(
            controller: _scrollController,
            slivers: [
              // 1. Fixed Header: Logo, Location Capsule Pill, Notifications, Profile Avatar
              HomeHeaderAppBar(
                locationName: locationName,
                addressLine: addressLine,
                avatarUrl: user?.avatarUrl,
                onLocationTap: _showLocationSelector,
                onNotificationTap: () => context.push('/notifications'),
                onProfileTap: () => context.go('/profile'),
              ),

              // 2. Main Content Container matching HTML template
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList.list(
                  children: [
                    const SizedBox(height: 12),

                    // Section 1: Greeting + Search & Tune Filter Pill
                    HomePersonalizationSection(
                      userName: displayName,
                      onFilterTap: () => context.push('/services'),
                      onSearchTap: () => context.push('/services'),
                    ),
                    const SizedBox(height: 20),

                    // Section 2: Core Services (8 items in 4x2 grid)
                    HomeServiceCategoriesSection(
                      onCategoryTap: _onCategorySelected,
                      onSeeAllTap: () => context.push('/services'),
                    ),
                    const SizedBox(height: 20),

                    // Section 3: Nearby Specialists
                    NearbyProvidersSection(
                      customerAddressId: selectedAddress?.id,
                    ),
                    const SizedBox(height: 88),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      floatingActionButton: const HomeChatbotMascotFab(),
    );
  }
}

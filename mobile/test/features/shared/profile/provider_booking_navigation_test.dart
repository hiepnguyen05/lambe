import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/features/customer/booking/domain/entities/provider_booking_entry.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_filter_params.dart';
import 'package:mobile/features/customer/catalog/domain/entities/service_item_entity.dart';
import 'package:mobile/features/customer/catalog/domain/repositories/catalog_repository.dart';
import 'package:mobile/features/customer/catalog/presentation/providers/catalog_providers.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';
import 'package:mobile/features/shared/profile/domain/entities/partner_public_profile_entity.dart';
import 'package:mobile/features/shared/profile/presentation/screens/partner_public_profile_screen.dart';

void main() {
  testWidgets(
    'booking from a public profile preserves the selected offering and catalog service',
    (tester) async {
      const profile = PartnerPublicProfileEntity(
        id: 'provider',
        displayName: 'Thợ tóc',
        biography: 'Tóc nam',
        experienceYears: 3,
        serviceAreaName: 'Hà Nội',
        serviceRadiusKm: 10,
        services: [
          PublicServiceItemEntity(
            id: 'offering',
            serviceId: 'hair',
            name: 'Cắt tóc nam',
            slug: 'cat-toc-nam',
            categoryName: 'Tóc',
            categorySlug: 'toc',
            priceAmount: 150000,
            durationMinutes: 45,
          ),
        ],
      );
      ProviderBookingEntry? received;
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (_, __) =>
                const PartnerPublicProfileScreen(providerId: 'provider'),
          ),
          GoRoute(
            path: '/booking/config',
            builder: (_, state) {
              received = state.extra as ProviderBookingEntry;
              return const Scaffold(body: Text('Cấu hình đặt lịch'));
            },
          ),
        ],
      );
      addTearDown(router.dispose);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            publicPartnerProfileProvider('provider')
                .overrideWith((ref) async => profile),
            catalogRepositoryProvider.overrideWithValue(_Catalog()),
          ],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Đặt lịch'));
      await tester.tap(find.text('Đặt lịch'));
      await tester.pumpAndSettle();
      expect(find.text('Cấu hình đặt lịch'), findsOneWidget);
      expect(received?.providerId, 'provider');
      expect(received?.providerServiceId, 'offering');
      expect(received?.service.id, 'hair');
      expect(received?.priceAmount, 150000);
    },
  );
}

class _Catalog implements CatalogRepository {
  @override
  Future<ServiceItemEntity> getServiceBySlug(String slug) async =>
      ServiceItemEntity(
        id: 'hair',
        code: 'HAIR',
        name: 'Cắt tóc nam',
        slug: slug,
        minPriceAmount: 100000,
        maxPriceAmount: 200000,
        category: const ServiceCategorySummaryEntity(
          id: 'category',
          code: 'HAIR',
          name: 'Tóc',
          slug: 'toc',
        ),
      );

  @override
  Future<List<ServiceItemEntity>> getServices(
    ServiceFilterParams params,
  ) async => [];
}

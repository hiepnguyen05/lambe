import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/dio_client.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../application/partner_notifier.dart';
import '../data/datasources/dio_partner_remote_datasource.dart';
import '../data/repositories/partner_repository_impl.dart';
import '../data/repositories/secure_partner_draft_repository.dart';
import '../domain/entities/provider_application_entity.dart';
import '../domain/entities/service_catalog_entity.dart';
import '../domain/repositories/partner_repository.dart';

final partnerRepositoryProvider = Provider<PartnerRepository>((ref) {
  return PartnerRepositoryImpl(
    DioPartnerRemoteDataSource(ref.watch(dioProvider)),
  );
});

final masterServicesProvider = FutureProvider<List<ServiceCatalogEntity>>((
  ref,
) {
  return ref.watch(partnerRepositoryProvider).getAllServices();
});

final partnerNotifierProvider =
    StateNotifierProvider<
      PartnerNotifier,
      AsyncValue<ProviderApplicationEntity?>
    >((ref) {
      ref.watch(authNotifierProvider.select((s) => s.valueOrNull?.id));
      return PartnerNotifier(
        ref.watch(partnerRepositoryProvider),
        SecurePartnerDraftRepository(ref.watch(flutterSecureStorageProvider)),
      );
    });

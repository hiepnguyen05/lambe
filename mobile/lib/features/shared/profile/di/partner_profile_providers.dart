import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/network/dio_client.dart';

import '../application/partner_profile_notifier.dart';
import '../data/datasources/partner_profile_remote_datasource.dart';
import '../data/repositories/partner_profile_repository_impl.dart';
import '../domain/entities/partner_profile_entity.dart';
import '../domain/entities/partner_public_profile_entity.dart';
import '../domain/repositories/partner_profile_repository.dart';

final partnerProfileRemoteDataSourceProvider =
    Provider<PartnerProfileRemoteDataSource>((ref) {
      return DioPartnerProfileRemoteDataSource(ref.watch(dioProvider));
    });

final partnerProfileRepositoryProvider = Provider<PartnerProfileRepository>((
  ref,
) {
  return PartnerProfileRepositoryImpl(
    ref.watch(partnerProfileRemoteDataSourceProvider),
  );
});

final partnerProfileNotifierProvider =
    AsyncNotifierProvider<PartnerProfileNotifier, PartnerProfileEntity>(() {
      return PartnerProfileNotifier();
    });

final publicPartnerProfileProvider =
    FutureProvider.family<PartnerPublicProfileEntity, String>((
      ref,
      providerId,
    ) async {
      final repository = ref.watch(partnerProfileRepositoryProvider);
      return repository.getPublicProfile(providerId);
    });

/// Feature flag to toggle organization partner features (Soft-disable mode).
/// Set to true to re-enable organization workspace, team management, and member dispatching.
final isOrganizationFeatureEnabledProvider = Provider<bool>((ref) => false);

final isOrganizationProvider = Provider<bool>((ref) {
  final isOrgEnabled = ref.watch(isOrganizationFeatureEnabledProvider);
  if (!isOrgEnabled) return false;
  final profile = ref.watch(partnerProfileNotifierProvider).valueOrNull;
  return profile?.isOrganization ?? false;
});

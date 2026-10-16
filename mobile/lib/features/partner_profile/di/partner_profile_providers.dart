import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/dio_client.dart';
import '../application/partner_profile_notifier.dart';
import '../data/datasources/partner_profile_remote_datasource.dart';
import '../data/repositories/partner_profile_repository_impl.dart';
import '../domain/entities/partner_profile_entity.dart';
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

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/entities/partner_profile_entity.dart';
import '../domain/repositories/partner_profile_repository.dart';
import '../di/partner_profile_providers.dart';

class PartnerProfileNotifier extends AsyncNotifier<PartnerProfileEntity> {
  late final PartnerProfileRepository _repository;

  @override
  Future<PartnerProfileEntity> build() async {
    _repository = ref.watch(partnerProfileRepositoryProvider);
    final profile = await _repository.getProfile();
    return profile ??
        const PartnerProfileEntity(id: '', displayName: 'Đối tác Lambe');
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final profile = await _repository.getProfile();
      return profile ??
          const PartnerProfileEntity(id: '', displayName: 'Đối tác Lambe');
    });
  }
}

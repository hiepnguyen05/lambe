import '../entities/partner_profile_entity.dart';
import '../entities/partner_public_profile_entity.dart';

abstract class PartnerProfileRepository {
  Future<PartnerProfileEntity?> getProfile();
  Future<PartnerPublicProfileEntity> getPublicProfile(String providerId);
}

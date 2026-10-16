import '../entities/partner_profile_entity.dart';

abstract class PartnerProfileRepository {
  Future<PartnerProfileEntity?> getProfile();
}

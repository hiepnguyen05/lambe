import '../../domain/entities/partner_profile_entity.dart';
import '../../domain/repositories/partner_profile_repository.dart';
import '../datasources/partner_profile_remote_datasource.dart';

class PartnerProfileRepositoryImpl implements PartnerProfileRepository {
  final PartnerProfileRemoteDataSource _remoteDataSource;

  PartnerProfileRepositoryImpl(this._remoteDataSource);

  @override
  Future<PartnerProfileEntity?> getProfile() {
    return _remoteDataSource.getProfile();
  }
}

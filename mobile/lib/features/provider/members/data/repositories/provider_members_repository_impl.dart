import '../../domain/entities/member_service_offering_entity.dart';
import '../../domain/entities/organization_receiving_entity.dart';
import '../../domain/entities/provider_member_entity.dart';
import '../../domain/entities/provider_member_invitation_entity.dart';
import '../../domain/entities/provider_membership_entity.dart';
import '../../domain/entities/worker_availability_entity.dart';
import '../../domain/entities/worker_collection_entity.dart';
import '../../domain/repositories/provider_members_repository.dart';
import '../datasources/provider_members_remote_datasource.dart';

class ProviderMembersRepositoryImpl implements ProviderMembersRepository {
  final ProviderMembersRemoteDataSource _remoteDataSource;

  ProviderMembersRepositoryImpl(this._remoteDataSource);

  @override
  Future<List<ProviderMemberEntity>> getMembers({
    int page = 1,
    int limit = 50,
  }) {
    return _remoteDataSource.getMembers(page: page, limit: limit);
  }

  @override
  Future<List<ProviderMemberInvitationEntity>> getInvitations({
    int page = 1,
    int limit = 50,
  }) {
    return _remoteDataSource.getInvitations(page: page, limit: limit);
  }

  @override
  Future<ProviderMemberInvitationEntity> createInvitation(String phone) {
    return _remoteDataSource.createInvitation(phone);
  }

  @override
  Future<ProviderMemberInvitationEntity> resendInvitation(String invitationId) {
    return _remoteDataSource.resendInvitation(invitationId);
  }

  @override
  Future<void> revokeInvitation(String invitationId) {
    return _remoteDataSource.revokeInvitation(invitationId);
  }

  @override
  Future<ProviderMemberEntity> suspendMember(String memberId, String reason) {
    return _remoteDataSource.suspendMember(memberId, reason);
  }

  @override
  Future<ProviderMemberEntity> reactivateMember(
    String memberId,
    String reason,
  ) {
    return _remoteDataSource.reactivateMember(memberId, reason);
  }

  @override
  Future<List<MemberServiceOfferingEntity>> getMemberServiceOptions(
    String memberId,
  ) {
    return _remoteDataSource.getMemberServiceOptions(memberId);
  }

  @override
  Future<List<MemberServiceOfferingEntity>> getMemberServices(String memberId) {
    return _remoteDataSource.getMemberServices(memberId);
  }

  @override
  Future<List<MemberServiceOfferingEntity>> assignMemberServices(
    String memberId,
    List<String> providerServiceIds,
    String reason,
  ) {
    return _remoteDataSource.assignMemberServices(
      memberId,
      providerServiceIds,
      reason,
    );
  }

  @override
  Future<List<Map<String, dynamic>>> getMemberWorkingHours(String memberId) {
    return _remoteDataSource.getMemberWorkingHours(memberId);
  }

  @override
  Future<List<Map<String, dynamic>>> updateMemberWorkingHours(
    String memberId,
    List<Map<String, dynamic>> hours,
    String reason,
  ) {
    return _remoteDataSource.updateMemberWorkingHours(memberId, hours, reason);
  }

  @override
  Future<List<Map<String, dynamic>>> getMemberTimeOffs(
    String memberId, {
    DateTime? from,
    DateTime? to,
  }) {
    return _remoteDataSource.getMemberTimeOffs(memberId, from: from, to: to);
  }

  @override
  Future<Map<String, dynamic>> addMemberTimeOff(
    String memberId,
    DateTime startAt,
    DateTime endAt,
    String reason,
  ) {
    return _remoteDataSource.addMemberTimeOff(
      memberId,
      startAt,
      endAt,
      reason,
    );
  }

  @override
  Future<void> deleteMemberTimeOff(
    String memberId,
    String timeOffId,
    String reason,
  ) {
    return _remoteDataSource.deleteMemberTimeOff(memberId, timeOffId, reason);
  }

  @override
  Future<OrganizationReceivingEntity> getOrganizationReceivingStatus() {
    return _remoteDataSource.getOrganizationReceivingStatus();
  }

  @override
  Future<OrganizationReceivingEntity> updateOrganizationReceivingStatus(
    bool enabled,
    String reason,
  ) {
    return _remoteDataSource.updateOrganizationReceivingStatus(enabled, reason);
  }

  @override
  Future<List<ProviderMembershipEntity>> getMyMemberships() {
    return _remoteDataSource.getMyMemberships();
  }

  @override
  Future<WorkerAvailabilityEntity> getWorkerAvailability(String membershipId) {
    return _remoteDataSource.getWorkerAvailability(membershipId);
  }

  @override
  Future<WorkerAvailabilityEntity> setWorkerOnline(
    String membershipId,
    double latitude,
    double longitude,
  ) {
    return _remoteDataSource.setWorkerOnline(
      membershipId,
      latitude,
      longitude,
    );
  }

  @override
  Future<WorkerAvailabilityEntity> sendWorkerHeartbeat(
    String membershipId,
    double latitude,
    double longitude,
  ) {
    return _remoteDataSource.sendWorkerHeartbeat(
      membershipId,
      latitude,
      longitude,
    );
  }

  @override
  Future<WorkerAvailabilityEntity> setWorkerOffline(
    String membershipId, {
    String? reason,
  }) {
    return _remoteDataSource.setWorkerOffline(membershipId, reason: reason);
  }

  @override
  Future<WorkerReceivingSettingsEntity> getWorkerReceivingSettings(
    String membershipId,
  ) {
    return _remoteDataSource.getWorkerReceivingSettings(membershipId);
  }

  @override
  Future<WorkerReceivingSettingsEntity> updateWorkerReceivingSettings(
    String membershipId,
    int radiusKm,
  ) {
    return _remoteDataSource.updateWorkerReceivingSettings(
      membershipId,
      radiusKm,
    );
  }

  @override
  Future<WorkerCollectionSummaryEntity> getWorkerCollectionsSummary(
    String membershipId, {
    DateTime? from,
    DateTime? to,
  }) {
    return _remoteDataSource.getWorkerCollectionsSummary(
      membershipId,
      from: from,
      to: to,
    );
  }

  @override
  Future<List<WorkerCollectionOrderItemEntity>> getWorkerCollectionsOrders(
    String membershipId, {
    DateTime? from,
    DateTime? to,
    String? cursor,
  }) {
    return _remoteDataSource.getWorkerCollectionsOrders(
      membershipId,
      from: from,
      to: to,
      cursor: cursor,
    );
  }

  @override
  Future<List<Map<String, dynamic>>> getPendingOrganizationFeedPosts() {
    return _remoteDataSource.getPendingOrganizationFeedPosts();
  }

  @override
  Future<void> reviewOrganizationFeedPost(
    String postId,
    int revisionNumber,
    String decision,
    String? note,
  ) {
    return _remoteDataSource.reviewOrganizationFeedPost(
      postId,
      revisionNumber,
      decision,
      note,
    );
  }
}

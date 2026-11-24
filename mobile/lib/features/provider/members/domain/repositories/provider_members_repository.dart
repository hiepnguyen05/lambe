import '../entities/member_service_offering_entity.dart';
import '../entities/organization_receiving_entity.dart';
import '../entities/provider_member_entity.dart';
import '../entities/provider_member_invitation_entity.dart';
import '../entities/provider_membership_entity.dart';
import '../entities/worker_availability_entity.dart';
import '../entities/worker_collection_entity.dart';

abstract class ProviderMembersRepository {
  Future<List<ProviderMemberEntity>> getMembers({int page = 1, int limit = 50});
  Future<List<ProviderMemberInvitationEntity>> getInvitations({
    int page = 1,
    int limit = 50,
  });
  Future<ProviderMemberInvitationEntity> createInvitation(String phone);
  Future<ProviderMemberInvitationEntity> resendInvitation(String invitationId);
  Future<void> revokeInvitation(String invitationId);
  Future<ProviderMemberEntity> suspendMember(String memberId, String reason);
  Future<ProviderMemberEntity> reactivateMember(String memberId, String reason);

  // Capabilities: Service assignment
  Future<List<MemberServiceOfferingEntity>> getMemberServiceOptions(String memberId);
  Future<List<MemberServiceOfferingEntity>> getMemberServices(String memberId);
  Future<List<MemberServiceOfferingEntity>> assignMemberServices(
    String memberId,
    List<String> providerServiceIds,
    String reason,
  );

  // Capabilities: Working hours & Time-off
  Future<List<Map<String, dynamic>>> getMemberWorkingHours(String memberId);
  Future<List<Map<String, dynamic>>> updateMemberWorkingHours(
    String memberId,
    List<Map<String, dynamic>> hours,
    String reason,
  );
  Future<List<Map<String, dynamic>>> getMemberTimeOffs(
    String memberId, {
    DateTime? from,
    DateTime? to,
  });
  Future<Map<String, dynamic>> addMemberTimeOff(
    String memberId,
    DateTime startAt,
    DateTime endAt,
    String reason,
  );
  Future<void> deleteMemberTimeOff(
    String memberId,
    String timeOffId,
    String reason,
  );

  // Organization Emergency Receiving Toggle
  Future<OrganizationReceivingEntity> getOrganizationReceivingStatus();
  Future<OrganizationReceivingEntity> updateOrganizationReceivingStatus(
    bool enabled,
    String reason,
  );

  // Worker Profile & Memberships
  Future<List<ProviderMembershipEntity>> getMyMemberships();

  // Worker Availability & Heartbeat
  Future<WorkerAvailabilityEntity> getWorkerAvailability(String membershipId);
  Future<WorkerAvailabilityEntity> setWorkerOnline(
    String membershipId,
    double latitude,
    double longitude,
  );
  Future<WorkerAvailabilityEntity> sendWorkerHeartbeat(
    String membershipId,
    double latitude,
    double longitude,
  );
  Future<WorkerAvailabilityEntity> setWorkerOffline(
    String membershipId, {
    String? reason,
  });
  Future<WorkerReceivingSettingsEntity> getWorkerReceivingSettings(
    String membershipId,
  );
  Future<WorkerReceivingSettingsEntity> updateWorkerReceivingSettings(
    String membershipId,
    int radiusKm,
  );

  // Worker Cash Collections
  Future<WorkerCollectionSummaryEntity> getWorkerCollectionsSummary(
    String membershipId, {
    DateTime? from,
    DateTime? to,
  });
  Future<List<WorkerCollectionOrderItemEntity>> getWorkerCollectionsOrders(
    String membershipId, {
    DateTime? from,
    DateTime? to,
    String? cursor,
  });

  // Owner Organization Feed Review
  Future<List<Map<String, dynamic>>> getPendingOrganizationFeedPosts();
  Future<void> reviewOrganizationFeedPost(
    String postId,
    int revisionNumber,
    String decision,
    String? note,
  );
}

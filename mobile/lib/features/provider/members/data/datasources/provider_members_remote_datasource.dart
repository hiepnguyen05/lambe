import 'package:dio/dio.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../models/provider_member_invitation_model.dart';
import '../models/provider_member_model.dart';
import '../../domain/entities/member_service_offering_entity.dart';
import '../../domain/entities/organization_receiving_entity.dart';
import '../../domain/entities/provider_membership_entity.dart';
import '../../domain/entities/worker_availability_entity.dart';
import '../../domain/entities/worker_collection_entity.dart';

abstract class ProviderMembersRemoteDataSource {
  Future<List<ProviderMemberModel>> getMembers({int page = 1, int limit = 50});
  Future<List<ProviderMemberInvitationModel>> getInvitations({
    int page = 1,
    int limit = 50,
  });
  Future<ProviderMemberInvitationModel> createInvitation(String phone);
  Future<ProviderMemberInvitationModel> resendInvitation(String invitationId);
  Future<void> revokeInvitation(String invitationId);
  Future<ProviderMemberModel> suspendMember(String memberId, String reason);
  Future<ProviderMemberModel> reactivateMember(String memberId, String reason);

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

class DioProviderMembersRemoteDataSource
    implements ProviderMembersRemoteDataSource {
  final Dio _dio;

  DioProviderMembersRemoteDataSource(this._dio);

  @override
  Future<List<ProviderMemberModel>> getMembers({
    int page = 1,
    int limit = 50,
  }) async {
    final response = await _dio.get(
      '/me/provider/members',
      queryParameters: {'page': page, 'limit': limit},
    );
    final list = ApiResponseParser.dataList(response);
    return list
        .map((item) => ProviderMemberModel.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  @override
  Future<List<ProviderMemberInvitationModel>> getInvitations({
    int page = 1,
    int limit = 50,
  }) async {
    final response = await _dio.get(
      '/me/provider/member-invitations',
      queryParameters: {'page': page, 'limit': limit},
    );
    final list = ApiResponseParser.dataList(response);
    return list
        .map((item) =>
            ProviderMemberInvitationModel.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  @override
  Future<ProviderMemberInvitationModel> createInvitation(String phone) async {
    final response = await _dio.post(
      '/me/provider/member-invitations',
      data: {'phone': phone},
    );
    final data = ApiResponseParser.dataMap(response);
    return ProviderMemberInvitationModel.fromJson(data);
  }

  @override
  Future<ProviderMemberInvitationModel> resendInvitation(
    String invitationId,
  ) async {
    final response = await _dio.post(
      '/me/provider/member-invitations/$invitationId/resend',
    );
    final data = ApiResponseParser.dataMap(response);
    return ProviderMemberInvitationModel.fromJson(data);
  }

  @override
  Future<void> revokeInvitation(String invitationId) async {
    final response = await _dio.post(
      '/me/provider/member-invitations/$invitationId/revoke',
    );
    ApiResponseParser.ensureSuccess(response);
  }

  @override
  Future<ProviderMemberModel> suspendMember(
    String memberId,
    String reason,
  ) async {
    final response = await _dio.post(
      '/me/provider/members/$memberId/suspend',
      data: {'reason': reason},
    );
    final data = ApiResponseParser.dataMap(response);
    return ProviderMemberModel.fromJson(data);
  }

  @override
  Future<ProviderMemberModel> reactivateMember(
    String memberId,
    String reason,
  ) async {
    final response = await _dio.post(
      '/me/provider/members/$memberId/reactivate',
      data: {'reason': reason},
    );
    final data = ApiResponseParser.dataMap(response);
    return ProviderMemberModel.fromJson(data);
  }

  // --- Capabilities: Service assignment ---

  @override
  Future<List<MemberServiceOfferingEntity>> getMemberServiceOptions(
    String memberId,
  ) async {
    final response = await _dio.get(
      '/me/provider/members/$memberId/service-options',
    );
    final list = ApiResponseParser.dataList(response);
    return list
        .map((item) => MemberServiceOfferingEntity.fromJson(
            Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  @override
  Future<List<MemberServiceOfferingEntity>> getMemberServices(
    String memberId,
  ) async {
    final response = await _dio.get(
      '/me/provider/members/$memberId/services',
    );
    final list = ApiResponseParser.dataList(response);
    return list
        .map((item) => MemberServiceOfferingEntity.fromJson(
            Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  @override
  Future<List<MemberServiceOfferingEntity>> assignMemberServices(
    String memberId,
    List<String> providerServiceIds,
    String reason,
  ) async {
    final response = await _dio.put(
      '/me/provider/members/$memberId/services',
      data: {
        'providerServiceIds': providerServiceIds,
        'reason': reason,
      },
    );
    final list = ApiResponseParser.dataList(response);
    return list
        .map((item) => MemberServiceOfferingEntity.fromJson(
            Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  // --- Capabilities: Working hours & Time-offs ---

  @override
  Future<List<Map<String, dynamic>>> getMemberWorkingHours(
    String memberId,
  ) async {
    final response = await _dio.get(
      '/me/provider/members/$memberId/working-hours',
    );
    final list = ApiResponseParser.dataList(response);
    return list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  @override
  Future<List<Map<String, dynamic>>> updateMemberWorkingHours(
    String memberId,
    List<Map<String, dynamic>> hours,
    String reason,
  ) async {
    final response = await _dio.put(
      '/me/provider/members/$memberId/working-hours',
      data: {
        'hours': hours,
        'reason': reason,
      },
    );
    final list = ApiResponseParser.dataList(response);
    return list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  @override
  Future<List<Map<String, dynamic>>> getMemberTimeOffs(
    String memberId, {
    DateTime? from,
    DateTime? to,
  }) async {
    final query = <String, dynamic>{};
    if (from != null) query['from'] = from.toUtc().toIso8601String();
    if (to != null) query['to'] = to.toUtc().toIso8601String();

    final response = await _dio.get(
      '/me/provider/members/$memberId/time-offs',
      queryParameters: query,
    );
    final list = ApiResponseParser.dataList(response);
    return list.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  @override
  Future<Map<String, dynamic>> addMemberTimeOff(
    String memberId,
    DateTime startAt,
    DateTime endAt,
    String reason,
  ) async {
    final response = await _dio.post(
      '/me/provider/members/$memberId/time-offs',
      data: {
        'startAt': startAt.toUtc().toIso8601String(),
        'endAt': endAt.toUtc().toIso8601String(),
        'reason': reason,
      },
    );
    return ApiResponseParser.dataMap(response);
  }

  @override
  Future<void> deleteMemberTimeOff(
    String memberId,
    String timeOffId,
    String reason,
  ) async {
    final response = await _dio.delete(
      '/me/provider/members/$memberId/time-offs/$timeOffId',
      data: {'reason': reason},
    );
    ApiResponseParser.ensureSuccess(response);
  }

  // --- Organization Receiving Toggle ---

  @override
  Future<OrganizationReceivingEntity> getOrganizationReceivingStatus() async {
    final response = await _dio.get('/me/provider/member-receiving');
    final data = ApiResponseParser.dataMap(response);
    return OrganizationReceivingEntity.fromJson(data);
  }

  @override
  Future<OrganizationReceivingEntity> updateOrganizationReceivingStatus(
    bool enabled,
    String reason,
  ) async {
    final response = await _dio.put(
      '/me/provider/member-receiving',
      data: {'enabled': enabled, 'reason': reason},
    );
    final data = ApiResponseParser.dataMap(response);
    return OrganizationReceivingEntity.fromJson(data);
  }

  // --- Worker Profile & Memberships ---

  @override
  Future<List<ProviderMembershipEntity>> getMyMemberships() async {
    final response = await _dio.get('/me/provider/memberships');
    final list = ApiResponseParser.dataList(response);
    return list
        .map((item) => ProviderMembershipEntity.fromJson(
            Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  // --- Worker Availability & Heartbeat ---

  @override
  Future<WorkerAvailabilityEntity> getWorkerAvailability(
    String membershipId,
  ) async {
    final response = await _dio.get(
      '/me/provider/memberships/$membershipId/availability',
    );
    final data = ApiResponseParser.dataMap(response);
    return WorkerAvailabilityEntity.fromJson(data);
  }

  @override
  Future<WorkerAvailabilityEntity> setWorkerOnline(
    String membershipId,
    double latitude,
    double longitude,
  ) async {
    final response = await _dio.post(
      '/me/provider/memberships/$membershipId/availability/online',
      data: {'latitude': latitude, 'longitude': longitude},
    );
    final data = ApiResponseParser.dataMap(response);
    return WorkerAvailabilityEntity.fromJson(data);
  }

  @override
  Future<WorkerAvailabilityEntity> sendWorkerHeartbeat(
    String membershipId,
    double latitude,
    double longitude,
  ) async {
    final response = await _dio.post(
      '/me/provider/memberships/$membershipId/availability/heartbeat',
      data: {'latitude': latitude, 'longitude': longitude},
    );
    final data = ApiResponseParser.dataMap(response);
    return WorkerAvailabilityEntity.fromJson(data);
  }

  @override
  Future<WorkerAvailabilityEntity> setWorkerOffline(
    String membershipId, {
    String? reason,
  }) async {
    final response = await _dio.post(
      '/me/provider/memberships/$membershipId/availability/offline',
      data: reason != null ? {'reason': reason} : null,
    );
    final data = ApiResponseParser.dataMap(response);
    return WorkerAvailabilityEntity.fromJson(data);
  }

  @override
  Future<WorkerReceivingSettingsEntity> getWorkerReceivingSettings(
    String membershipId,
  ) async {
    final response = await _dio.get(
      '/me/provider/memberships/$membershipId/receiving-settings',
    );
    final data = ApiResponseParser.dataMap(response);
    return WorkerReceivingSettingsEntity.fromJson(data);
  }

  @override
  Future<WorkerReceivingSettingsEntity> updateWorkerReceivingSettings(
    String membershipId,
    int radiusKm,
  ) async {
    final response = await _dio.put(
      '/me/provider/memberships/$membershipId/receiving-settings',
      data: {'receivingRadiusKm': radiusKm},
    );
    final data = ApiResponseParser.dataMap(response);
    return WorkerReceivingSettingsEntity.fromJson(data);
  }

  // --- Worker Cash Collections ---

  @override
  Future<WorkerCollectionSummaryEntity> getWorkerCollectionsSummary(
    String membershipId, {
    DateTime? from,
    DateTime? to,
  }) async {
    final query = <String, dynamic>{};
    if (from != null) query['from'] = from.toUtc().toIso8601String();
    if (to != null) query['to'] = to.toUtc().toIso8601String();

    final response = await _dio.get(
      '/me/provider/memberships/$membershipId/collections/summary',
      queryParameters: query,
    );
    final data = ApiResponseParser.dataMap(response);
    return WorkerCollectionSummaryEntity.fromJson(data);
  }

  @override
  Future<List<WorkerCollectionOrderItemEntity>> getWorkerCollectionsOrders(
    String membershipId, {
    DateTime? from,
    DateTime? to,
    String? cursor,
  }) async {
    final query = <String, dynamic>{};
    if (from != null) query['from'] = from.toUtc().toIso8601String();
    if (to != null) query['to'] = to.toUtc().toIso8601String();
    if (cursor != null) query['cursor'] = cursor;

    final response = await _dio.get(
      '/me/provider/memberships/$membershipId/collections/orders',
      queryParameters: query,
    );
    final data = ApiResponseParser.dataMap(response);
    final items = data['items'] is List ? data['items'] as List : <dynamic>[];

    return items
        .map((item) => WorkerCollectionOrderItemEntity.fromJson(
            Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  // --- Owner Organization Feed Review ---

  @override
  Future<List<Map<String, dynamic>>> getPendingOrganizationFeedPosts() async {
    final response = await _dio.get(
      '/me/feed/mine',
      queryParameters: {'organizationReviewStatus': 'PENDING'},
    );
    final data = ApiResponseParser.dataMap(response);
    final items = data['items'] is List ? data['items'] as List : <dynamic>[];
    return items.map((item) => Map<String, dynamic>.from(item as Map)).toList();
  }

  @override
  Future<void> reviewOrganizationFeedPost(
    String postId,
    int revisionNumber,
    String decision,
    String? note,
  ) async {
    final response = await _dio.post(
      '/me/feed/posts/$postId/organization-review',
      data: {
        'revisionNumber': revisionNumber,
        'decision': decision,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    ApiResponseParser.ensureSuccess(response);
  }
}

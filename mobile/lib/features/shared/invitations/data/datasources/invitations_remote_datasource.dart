import 'package:dio/dio.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../../domain/entities/received_invitation_entity.dart';

abstract class InvitationsRemoteDataSource {
  Future<List<ReceivedInvitationEntity>> getMyInvitations();
  Future<Map<String, dynamic>> acceptInvitation(
    String invitationId,
    String token,
  );
  Future<void> declineInvitation(String invitationId, String token);
}

class DioInvitationsRemoteDataSource implements InvitationsRemoteDataSource {
  final Dio _dio;

  DioInvitationsRemoteDataSource(this._dio);

  @override
  Future<List<ReceivedInvitationEntity>> getMyInvitations() async {
    final response = await _dio.get('/me/provider-invitations');
    final list = ApiResponseParser.dataList(response);
    return list.map((item) {
      final map = Map<String, dynamic>.from(item as Map);
      final provider = (map['provider'] as Map?) ?? {};
      return ReceivedInvitationEntity(
        id: map['id']?.toString() ?? '',
        providerId: map['providerId']?.toString() ?? '',
        phone: map['phone']?.toString() ?? '',
        status: map['status']?.toString() ?? 'PENDING',
        expiresAt: DateTime.tryParse(map['expiresAt']?.toString() ?? '') ??
            DateTime.now(),
        createdAt: DateTime.tryParse(map['createdAt']?.toString() ?? '') ??
            DateTime.now(),
        providerDisplayName:
            provider['displayName']?.toString() ?? 'Cơ sở làm đẹp',
        providerAvatarUrl: provider['avatarUrl']?.toString(),
        providerServiceAreaName: provider['serviceAreaName']?.toString(),
      );
    }).toList();
  }

  @override
  Future<Map<String, dynamic>> acceptInvitation(
    String invitationId,
    String token,
  ) async {
    final response = await _dio.post(
      '/me/provider-invitations/$invitationId/accept',
      data: {'token': token.trim()},
    );
    return ApiResponseParser.dataMap(response);
  }

  @override
  Future<void> declineInvitation(String invitationId, String token) async {
    final response = await _dio.post(
      '/me/provider-invitations/$invitationId/decline',
      data: {'token': token.trim()},
    );
    ApiResponseParser.ensureSuccess(response);
  }
}

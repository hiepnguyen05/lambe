import '../entities/received_invitation_entity.dart';

abstract class InvitationsRepository {
  Future<List<ReceivedInvitationEntity>> getMyInvitations();
  Future<Map<String, dynamic>> acceptInvitation(
    String invitationId,
    String token,
  );
  Future<void> declineInvitation(String invitationId, String token);
}

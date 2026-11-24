import '../../domain/entities/received_invitation_entity.dart';
import '../../domain/repositories/invitations_repository.dart';
import '../datasources/invitations_remote_datasource.dart';

class InvitationsRepositoryImpl implements InvitationsRepository {
  final InvitationsRemoteDataSource _remoteDataSource;

  InvitationsRepositoryImpl(this._remoteDataSource);

  @override
  Future<List<ReceivedInvitationEntity>> getMyInvitations() {
    return _remoteDataSource.getMyInvitations();
  }

  @override
  Future<Map<String, dynamic>> acceptInvitation(
    String invitationId,
    String token,
  ) {
    return _remoteDataSource.acceptInvitation(invitationId, token);
  }

  @override
  Future<void> declineInvitation(String invitationId, String token) {
    return _remoteDataSource.declineInvitation(invitationId, token);
  }
}

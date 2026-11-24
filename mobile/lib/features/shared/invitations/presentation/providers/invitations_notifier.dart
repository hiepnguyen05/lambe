import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/received_invitation_entity.dart';
import '../../domain/repositories/invitations_repository.dart';

class InvitationsNotifier
    extends StateNotifier<AsyncValue<List<ReceivedInvitationEntity>>> {
  final InvitationsRepository _repository;

  InvitationsNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadInvitations();
  }

  Future<void> loadInvitations() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getMyInvitations();
      if (mounted) state = AsyncValue.data(list);
    } catch (e, st) {
      if (mounted) state = AsyncValue.error(e, st);
    }
  }

  Future<bool> accept(String invitationId, String token) async {
    try {
      await _repository.acceptInvitation(invitationId, token);
      if (mounted) await loadInvitations();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> decline(String invitationId, String token) async {
    try {
      await _repository.declineInvitation(invitationId, token);
      if (mounted) await loadInvitations();
      return true;
    } catch (_) {
      return false;
    }
  }
}

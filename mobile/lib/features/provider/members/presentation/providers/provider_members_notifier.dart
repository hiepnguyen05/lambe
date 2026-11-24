import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/provider_member_entity.dart';
import '../../domain/entities/provider_member_invitation_entity.dart';
import '../../domain/repositories/provider_members_repository.dart';

class ProviderMembersNotifier
    extends StateNotifier<AsyncValue<List<ProviderMemberEntity>>> {
  final ProviderMembersRepository _repository;

  ProviderMembersNotifier(this._repository)
    : super(const AsyncValue.loading()) {
    loadMembers();
  }

  Future<void> loadMembers() async {
    state = const AsyncValue.loading();
    try {
      final members = await _repository.getMembers();
      if (mounted) state = AsyncValue.data(members);
    } catch (e, st) {
      if (mounted) state = AsyncValue.error(e, st);
    }
  }

  Future<bool> suspendMember(String memberId, String reason) async {
    try {
      final updated = await _repository.suspendMember(memberId, reason);
      if (!mounted) return false;
      final currentList = state.valueOrNull ?? [];
      state = AsyncValue.data(
        currentList.map((m) => m.id == memberId ? updated : m).toList(),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> reactivateMember(String memberId, String reason) async {
    try {
      final updated = await _repository.reactivateMember(memberId, reason);
      if (!mounted) return false;
      final currentList = state.valueOrNull ?? [];
      state = AsyncValue.data(
        currentList.map((m) => m.id == memberId ? updated : m).toList(),
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

class ProviderInvitationsNotifier
    extends StateNotifier<AsyncValue<List<ProviderMemberInvitationEntity>>> {
  final ProviderMembersRepository _repository;

  ProviderInvitationsNotifier(this._repository)
    : super(const AsyncValue.loading()) {
    loadInvitations();
  }

  Future<void> loadInvitations() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getInvitations();
      if (mounted) state = AsyncValue.data(list);
    } catch (e, st) {
      if (mounted) state = AsyncValue.error(e, st);
    }
  }

  Future<ProviderMemberInvitationEntity?> createInvitation(String phone) async {
    try {
      final created = await _repository.createInvitation(phone);
      if (!mounted) return null;
      final currentList = state.valueOrNull ?? [];
      state = AsyncValue.data([created, ...currentList]);
      return created;
    } catch (_) {
      return null;
    }
  }

  Future<ProviderMemberInvitationEntity?> resendInvitation(
    String invitationId,
  ) async {
    try {
      final updated = await _repository.resendInvitation(invitationId);
      if (!mounted) return null;
      final currentList = state.valueOrNull ?? [];
      state = AsyncValue.data(
        currentList
            .map((inv) => inv.id == invitationId ? updated : inv)
            .toList(),
      );
      return updated;
    } catch (_) {
      return null;
    }
  }

  Future<bool> revokeInvitation(String invitationId) async {
    try {
      await _repository.revokeInvitation(invitationId);
      await loadInvitations();
      return true;
    } catch (_) {
      return false;
    }
  }
}

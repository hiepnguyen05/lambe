import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/dio_client.dart';

import '../data/datasources/invitations_remote_datasource.dart';
import '../data/repositories/invitations_repository_impl.dart';
import '../domain/entities/received_invitation_entity.dart';
import '../domain/repositories/invitations_repository.dart';
import '../presentation/providers/invitations_notifier.dart';

final invitationsRemoteDataSourceProvider =
    Provider<InvitationsRemoteDataSource>((ref) {
  final dio = ref.watch(dioProvider);
  return DioInvitationsRemoteDataSource(dio);
});

final invitationsRepositoryProvider = Provider<InvitationsRepository>((ref) {
  final dataSource = ref.watch(invitationsRemoteDataSourceProvider);
  return InvitationsRepositoryImpl(dataSource);
});

final myInvitationsNotifierProvider = StateNotifierProvider.autoDispose<
    InvitationsNotifier, AsyncValue<List<ReceivedInvitationEntity>>>((ref) {
  final repository = ref.watch(invitationsRepositoryProvider);
  return InvitationsNotifier(repository);
});

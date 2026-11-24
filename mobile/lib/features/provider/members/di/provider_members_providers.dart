import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/dio_client.dart';

import '../data/datasources/provider_members_remote_datasource.dart';
import '../data/repositories/provider_members_repository_impl.dart';
import '../domain/entities/provider_member_entity.dart';
import '../domain/entities/provider_member_invitation_entity.dart';
import '../domain/repositories/provider_members_repository.dart';
import '../presentation/providers/provider_members_notifier.dart';

final providerMembersRemoteDataSourceProvider =
    Provider<ProviderMembersRemoteDataSource>((ref) {
  final dio = ref.watch(dioProvider);
  return DioProviderMembersRemoteDataSource(dio);
});

final providerMembersRepositoryProvider =
    Provider<ProviderMembersRepository>((ref) {
  final dataSource = ref.watch(providerMembersRemoteDataSourceProvider);
  return ProviderMembersRepositoryImpl(dataSource);
});

final providerMembersNotifierProvider = StateNotifierProvider.autoDispose<
    ProviderMembersNotifier, AsyncValue<List<ProviderMemberEntity>>>((ref) {
  final repository = ref.watch(providerMembersRepositoryProvider);
  return ProviderMembersNotifier(repository);
});

final providerInvitationsNotifierProvider = StateNotifierProvider.autoDispose<
    ProviderInvitationsNotifier,
    AsyncValue<List<ProviderMemberInvitationEntity>>>((ref) {
  final repository = ref.watch(providerMembersRepositoryProvider);
  return ProviderInvitationsNotifier(repository);
});

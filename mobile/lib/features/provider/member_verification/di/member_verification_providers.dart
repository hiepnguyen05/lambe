import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/network/dio_client.dart';

import '../data/datasources/member_verification_remote_datasource.dart';
import '../data/repositories/member_verification_repository_impl.dart';
import '../domain/entities/member_verification_entity.dart';
import '../presentation/providers/member_verification_notifier.dart';

final memberVerificationRemoteDataSourceProvider =
    Provider<MemberVerificationRemoteDataSource>((ref) {
  final dio = ref.watch(dioProvider);
  return DioMemberVerificationRemoteDataSource(dio);
});

final memberVerificationRepositoryProvider =
    Provider<MemberVerificationRepository>((ref) {
  final dataSource = ref.watch(memberVerificationRemoteDataSourceProvider);
  return MemberVerificationRepositoryImpl(dataSource);
});

final memberVerificationNotifierProvider = StateNotifierProvider.family
    .autoDispose<MemberVerificationNotifier,
        AsyncValue<MemberVerificationProfileEntity?>, String>((ref, memberId) {
  final repository = ref.watch(memberVerificationRepositoryProvider);
  return MemberVerificationNotifier(repository, memberId);
});

final memberVerificationOptionsProvider = FutureProvider.family
    .autoDispose<List<MemberVerificationOptionService>, String>(
        (ref, memberId) {
  final repository = ref.watch(memberVerificationRepositoryProvider);
  return repository.getOptions(memberId);
});

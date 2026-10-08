import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../application/auth_notifier.dart';
import '../data/datasources/dio_auth_remote_datasource.dart';
import '../data/datasources/firebase_auth_identity_datasource.dart';
import '../data/repositories/auth_repository_impl.dart';
import '../domain/entities/user_entity.dart';
import '../domain/repositories/auth_repository.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    DioAuthRemoteDataSource(ref.watch(dioProvider)),
    FirebaseAuthIdentityDataSource(),
    ref.watch(secureStorageProvider),
  );
});

final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<UserEntity?>>((ref) {
      return AuthNotifier(ref.watch(authRepositoryProvider));
    });

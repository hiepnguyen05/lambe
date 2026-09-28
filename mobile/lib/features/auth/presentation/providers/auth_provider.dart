import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../core/storage/secure_storage_service.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

enum AuthStep { enterPhone, enterOtp, completeRegistration }

class AuthState {
  final AuthStep step;
  final String phone;
  final String? registrationToken;
  final UserEntity? user;
  final bool isLoading;
  final String? errorMessage;
  final bool isAuthenticated;

  const AuthState({
    this.step = AuthStep.enterPhone,
    this.phone = '',
    this.registrationToken,
    this.user,
    this.isLoading = false,
    this.errorMessage,
    this.isAuthenticated = false,
  });

  AuthState copyWith({
    AuthStep? step,
    String? phone,
    String? registrationToken,
    UserEntity? user,
    bool? isLoading,
    String? errorMessage,
    bool? isAuthenticated,
  }) {
    return AuthState(
      step: step ?? this.step,
      phone: phone ?? this.phone,
      registrationToken: registrationToken ?? this.registrationToken,
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
    );
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final dio = ref.watch(dioClientProvider);
  final storage = ref.watch(secureStorageProvider);
  final remoteDataSource = AuthRemoteDataSource(dio);
  return AuthRepositoryImpl(remoteDataSource, storage);
});

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final repository = ref.watch(authRepositoryProvider);
  return AuthNotifier(repository);
});

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repository;

  AuthNotifier(this._repository) : super(const AuthState());

  Future<void> checkInitialAuth() async {
    state = state.copyWith(isLoading: true);
    try {
      final user = await _repository.getCurrentUser();
      if (user != null) {
        state = state.copyWith(
          user: user,
          isAuthenticated: true,
          isLoading: false,
        );
      } else {
        state = state.copyWith(isLoading: false);
      }
    } catch (_) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<bool> sendOtp(String phone) async {
    state = state.copyWith(isLoading: true, errorMessage: null, phone: phone);
    try {
      await _repository.sendOtp(phone);
      state = state.copyWith(
        isLoading: false,
        step: AuthStep.enterOtp,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> verifyOtp(String code) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final result = await _repository.verifyOtp(state.phone, code);
      if (result.isNewUser) {
        state = state.copyWith(
          isLoading: false,
          step: AuthStep.completeRegistration,
          registrationToken: result.registrationToken,
        );
        return true;
      } else {
        state = state.copyWith(
          isLoading: false,
          user: result.user,
          isAuthenticated: true,
        );
        return true;
      }
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  Future<bool> completeRegistration(String fullName) async {
    if (state.registrationToken == null) return false;
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final user = await _repository.completeRegistration(state.registrationToken!, fullName);
      state = state.copyWith(
        isLoading: false,
        user: user,
        isAuthenticated: true,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: e.toString(),
      );
      return false;
    }
  }

  void resetToPhoneStep() {
    state = state.copyWith(step: AuthStep.enterPhone, errorMessage: null);
  }
}

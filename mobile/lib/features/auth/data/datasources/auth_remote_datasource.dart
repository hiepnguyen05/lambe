import 'package:dio/dio.dart';
import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/network/network_exceptions.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';

class AuthRemoteDataSource {
  final Dio _dio;

  AuthRemoteDataSource(this._dio);

  Future<void> sendOtp(String phone) async {
    try {
      await _dio.post(
        ApiEndpoints.sendOtp,
        data: {'phone': phone},
      );
    } on DioException catch (e) {
      throw ExceptionHandler.handleDioError(e);
    }
  }

  Future<VerifyOtpResult> verifyOtp(String phone, String code) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.verifyOtp,
        data: {
          'phone': phone,
          'code': code,
        },
      );

      final data = response.data['data'];
      final isNewUser = response.data['isNewUser'] == true;

      if (isNewUser) {
        return VerifyOtpResult(
          isNewUser: true,
          phone: data['phone'] as String?,
          registrationToken: data['registrationToken'] as String?,
        );
      } else {
        final userData = data['user'];
        final rolesList = (userData['roles'] as List?)?.map((e) => e.toString()).toList() ?? ['CUSTOMER'];

        final user = UserEntity(
          id: userData['id'] as String,
          phone: userData['phone'] as String,
          fullName: userData['fullName'] as String?,
          roles: rolesList,
          status: userData['status'] as String? ?? 'ACTIVE',
        );

        return VerifyOtpResult(
          isNewUser: false,
          accessToken: data['accessToken'] as String,
          user: user,
        );
      }
    } on DioException catch (e) {
      throw ExceptionHandler.handleDioError(e);
    }
  }

  Future<Map<String, dynamic>> completeRegistration(String registrationToken, String fullName) async {
    try {
      final response = await _dio.post(
        ApiEndpoints.completeRegistration,
        data: {
          'registrationToken': registrationToken,
          'fullName': fullName,
        },
      );
      return response.data['data'] as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ExceptionHandler.handleDioError(e);
    }
  }

  Future<UserEntity?> getCurrentUser() async {
    try {
      final response = await _dio.get(ApiEndpoints.me);
      final userData = response.data;
      if (userData == null) return null;

      final rolesList = (userData['roles'] as List?)?.map((e) => e.toString()).toList() ?? ['CUSTOMER'];

      return UserEntity(
        id: userData['id'] as String,
        phone: userData['phone'] as String,
        fullName: userData['fullName'] as String?,
        roles: rolesList,
        status: userData['status'] as String? ?? 'ACTIVE',
      );
    } on DioException catch (e) {
      throw ExceptionHandler.handleDioError(e);
    }
  }
}

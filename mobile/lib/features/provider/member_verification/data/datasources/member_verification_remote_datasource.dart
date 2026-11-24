import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:mobile/core/network/api_response_parser.dart';

import '../../domain/entities/member_verification_entity.dart';

abstract class MemberVerificationRemoteDataSource {
  Future<Map<String, dynamic>> getOptions(String memberId);
  Future<MemberVerificationProfileEntity?> getProfile(String memberId);
  Future<MemberVerificationProfileEntity> saveProfile(
    String memberId,
    Map<String, dynamic> data,
  );
  Future<MemberVerificationProfileEntity> submit(String memberId);
  Future<MemberVerificationDocumentEntity> uploadDocument({
    required String memberId,
    required String type,
    required Uint8List bytes,
    required String fileName,
    String? providerServiceId,
    String? expiresAt,
    String? replacesDocumentId,
  });
  Future<void> deleteDocument(String memberId, String documentId);
  Future<void> reopen(String memberId, String reason, List<String> documentIds);
}

class DioMemberVerificationRemoteDataSource
    implements MemberVerificationRemoteDataSource {
  final Dio _dio;

  DioMemberVerificationRemoteDataSource(this._dio);

  String _prefix(String memberId) =>
      '/me/provider/memberships/$memberId/verification';

  @override
  Future<Map<String, dynamic>> getOptions(String memberId) async {
    final response = await _dio.get('${_prefix(memberId)}/options');
    return ApiResponseParser.dataMap(response);
  }

  @override
  Future<MemberVerificationProfileEntity?> getProfile(String memberId) async {
    final response = await _dio.get(_prefix(memberId));
    final data = ApiResponseParser.dataMap(response);
    if (data.isEmpty || data['id'] == null) return null;
    return MemberVerificationProfileEntity.fromJson(data);
  }

  @override
  Future<MemberVerificationProfileEntity> saveProfile(
    String memberId,
    Map<String, dynamic> data,
  ) async {
    final response = await _dio.put(_prefix(memberId), data: data);
    final resData = ApiResponseParser.dataMap(response);
    return MemberVerificationProfileEntity.fromJson(resData);
  }

  @override
  Future<MemberVerificationProfileEntity> submit(String memberId) async {
    final response = await _dio.post('${_prefix(memberId)}/submit');
    final data = ApiResponseParser.dataMap(response);
    return MemberVerificationProfileEntity.fromJson(data);
  }

  @override
  Future<MemberVerificationDocumentEntity> uploadDocument({
    required String memberId,
    required String type,
    required Uint8List bytes,
    required String fileName,
    String? providerServiceId,
    String? expiresAt,
    String? replacesDocumentId,
  }) async {
    final queryParams = <String, dynamic>{
      'type': type,
      if (providerServiceId != null) 'providerServiceId': providerServiceId,
      if (expiresAt != null) 'expiresAt': expiresAt,
      if (replacesDocumentId != null) 'replacesDocumentId': replacesDocumentId,
    };

    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: fileName),
    });

    final response = await _dio.post(
      '${_prefix(memberId)}/documents',
      queryParameters: queryParams,
      data: formData,
    );
    final data = ApiResponseParser.dataMap(response);
    return MemberVerificationDocumentEntity.fromJson(data);
  }

  @override
  Future<void> deleteDocument(String memberId, String documentId) async {
    final response =
        await _dio.delete('${_prefix(memberId)}/documents/$documentId');
    ApiResponseParser.ensureSuccess(response);
  }

  @override
  Future<void> reopen(
    String memberId,
    String reason,
    List<String> documentIds,
  ) async {
    final response = await _dio.post(
      '${_prefix(memberId)}/reopen',
      data: {'reason': reason, 'documentIds': documentIds},
    );
    ApiResponseParser.ensureSuccess(response);
  }
}

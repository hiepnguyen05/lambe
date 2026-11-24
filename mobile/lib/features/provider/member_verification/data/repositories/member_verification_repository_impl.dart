import 'dart:typed_data';

import '../../domain/entities/member_verification_entity.dart';
import '../datasources/member_verification_remote_datasource.dart';

abstract class MemberVerificationRepository {
  Future<List<MemberVerificationOptionService>> getOptions(String memberId);
  Future<String> getTermsVersion(String memberId);
  Future<MemberVerificationProfileEntity?> getProfile(String memberId);
  Future<MemberVerificationProfileEntity> saveProfile({
    required String memberId,
    required String legalFullName,
    required String birthDate,
    required String gender,
    required String nationalIdNumber,
    required int experienceYears,
    required List<String> requestedProviderServiceIds,
    required String termsVersion,
  });
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

class MemberVerificationRepositoryImpl implements MemberVerificationRepository {
  final MemberVerificationRemoteDataSource _remoteDataSource;

  MemberVerificationRepositoryImpl(this._remoteDataSource);

  @override
  Future<List<MemberVerificationOptionService>> getOptions(
    String memberId,
  ) async {
    final data = await _remoteDataSource.getOptions(memberId);
    final services = (data['services'] as List<dynamic>?) ?? [];
    return services
        .map((s) => MemberVerificationOptionService.fromJson(
            Map<String, dynamic>.from(s as Map)))
        .toList();
  }

  @override
  Future<String> getTermsVersion(String memberId) async {
    final data = await _remoteDataSource.getOptions(memberId);
    return data['termsVersion']?.toString() ?? 'member-2026-10-27';
  }

  @override
  Future<MemberVerificationProfileEntity?> getProfile(String memberId) {
    return _remoteDataSource.getProfile(memberId);
  }

  @override
  Future<MemberVerificationProfileEntity> saveProfile({
    required String memberId,
    required String legalFullName,
    required String birthDate,
    required String gender,
    required String nationalIdNumber,
    required int experienceYears,
    required List<String> requestedProviderServiceIds,
    required String termsVersion,
  }) {
    final data = {
      'legalFullName': legalFullName.trim(),
      'birthDate': birthDate.trim(),
      'gender': gender,
      'nationalIdNumber': nationalIdNumber.trim(),
      'experienceYears': experienceYears,
      'requestedProviderServiceIds': requestedProviderServiceIds,
      'termsVersion': termsVersion,
      'acceptedTerms': true,
    };
    return _remoteDataSource.saveProfile(memberId, data);
  }

  @override
  Future<MemberVerificationProfileEntity> submit(String memberId) {
    return _remoteDataSource.submit(memberId);
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
  }) {
    return _remoteDataSource.uploadDocument(
      memberId: memberId,
      type: type,
      bytes: bytes,
      fileName: fileName,
      providerServiceId: providerServiceId,
      expiresAt: expiresAt,
      replacesDocumentId: replacesDocumentId,
    );
  }

  @override
  Future<void> deleteDocument(String memberId, String documentId) {
    return _remoteDataSource.deleteDocument(memberId, documentId);
  }

  @override
  Future<void> reopen(
    String memberId,
    String reason,
    List<String> documentIds,
  ) {
    return _remoteDataSource.reopen(memberId, reason, documentIds);
  }
}

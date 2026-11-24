import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/member_verification_repository_impl.dart';
import '../../domain/entities/member_verification_entity.dart';

class MemberVerificationNotifier
    extends StateNotifier<AsyncValue<MemberVerificationProfileEntity?>> {
  final MemberVerificationRepository _repository;
  final String memberId;

  MemberVerificationNotifier(this._repository, this.memberId)
      : super(const AsyncValue.loading()) {
    loadProfile();
  }

  Future<void> loadProfile() async {
    state = const AsyncValue.loading();
    try {
      final profile = await _repository.getProfile(memberId);
      state = AsyncValue.data(profile);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<bool> saveProfile({
    required String legalFullName,
    required String birthDate,
    required String gender,
    required String nationalIdNumber,
    required int experienceYears,
    required List<String> requestedProviderServiceIds,
  }) async {
    try {
      final termsVersion = await _repository.getTermsVersion(memberId);
      final updated = await _repository.saveProfile(
        memberId: memberId,
        legalFullName: legalFullName,
        birthDate: birthDate,
        gender: gender,
        nationalIdNumber: nationalIdNumber,
        experienceYears: experienceYears,
        requestedProviderServiceIds: requestedProviderServiceIds,
        termsVersion: termsVersion,
      );
      state = AsyncValue.data(updated);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> submit() async {
    try {
      final updated = await _repository.submit(memberId);
      state = AsyncValue.data(updated);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> uploadDocument({
    required String type,
    required Uint8List bytes,
    required String fileName,
    String? providerServiceId,
    String? expiresAt,
    String? replacesDocumentId,
  }) async {
    try {
      await _repository.uploadDocument(
        memberId: memberId,
        type: type,
        bytes: bytes,
        fileName: fileName,
        providerServiceId: providerServiceId,
        expiresAt: expiresAt,
        replacesDocumentId: replacesDocumentId,
      );
      await loadProfile();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> deleteDocument(String documentId) async {
    try {
      await _repository.deleteDocument(memberId, documentId);
      await loadProfile();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> reopen(String reason, List<String> documentIds) async {
    try {
      await _repository.reopen(memberId, reason, documentIds);
      await loadProfile();
      return true;
    } catch (_) {
      return false;
    }
  }
}

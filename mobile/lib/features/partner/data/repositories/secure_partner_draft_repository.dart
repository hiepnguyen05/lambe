import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../domain/entities/provider_application_update.dart';
import '../../domain/repositories/partner_draft_repository.dart';
import '../models/partner_api_model.dart';

class SecurePartnerDraftRepository implements PartnerDraftRepository {
  final FlutterSecureStorage _storage;

  const SecurePartnerDraftRepository(this._storage);

  String _key(String applicationId) => 'partner_info_draft_$applicationId';

  @override
  Future<void> save(
    String applicationId,
    ProviderApplicationUpdate draft,
  ) async {
    await _storage.write(
      key: _key(applicationId),
      value: jsonEncode(PartnerApiModel.applicationUpdateToJson(draft)),
    );
  }

  @override
  Future<ProviderApplicationUpdate?> load(String applicationId) async {
    final raw = await _storage.read(key: _key(applicationId));
    if (raw == null || raw.isEmpty) return null;
    final decoded = jsonDecode(raw);
    if (decoded is! Map) return null;
    final json = Map<String, dynamic>.from(decoded);
    return ProviderApplicationUpdate(
      email: json['email'] as String? ?? '',
      biography: json['biography'] as String? ?? '',
      legalFullName: json['legalFullName'] as String?,
      birthDate: json['birthDate'] as String?,
      gender: json['gender'] as String?,
      nationalIdNumber: json['nationalIdNumber'] as String?,
      experienceYears: (json['experienceYears'] as num?)?.toInt(),
      organizationName: json['organizationName'] as String?,
      taxCode: json['taxCode'] as String?,
      businessRegistrationNumber: json['businessRegistrationNumber'] as String?,
      registeredAddress: json['registeredAddress'] as String?,
      representativeName: json['representativeName'] as String?,
    );
  }

  @override
  Future<void> clear(String applicationId) {
    return _storage.delete(key: _key(applicationId));
  }
}

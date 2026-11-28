import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/core/utils/uuid_utils.dart';

final flutterSecureStorageProvider = Provider<FlutterSecureStorage>((ref) {
  return const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
});

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService(ref.watch(flutterSecureStorageProvider));
});

class SecureStorageService {
  final FlutterSecureStorage _storage;

  SecureStorageService(this._storage);

  static const String _keyAccessToken = 'access_token';
  static const String _keyRefreshToken = 'refresh_token';
  static const String _keyUserId = 'user_id';
  static const String _keyPhone = 'user_phone';
  static const String _keyRoles = 'user_roles';
  static const String _keyInstallationId = 'push_installation_id';
  static const String _keyPushPermissionExplained = 'push_permission_explained';

  Future<void> saveAccessToken(String token) async {
    await _storage.write(key: _keyAccessToken, value: token);
  }

  Future<String?> getAccessToken() async {
    return await _storage.read(key: _keyAccessToken);
  }

  Future<void> saveRefreshToken(String token) async {
    await _storage.write(key: _keyRefreshToken, value: token);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _keyRefreshToken);
  }

  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    await saveAccessToken(accessToken);
    if (refreshToken != null && refreshToken.isNotEmpty) {
      await saveRefreshToken(refreshToken);
    }
  }

  Future<void> saveUserSession({
    required String userId,
    required String phone,
    List<String>? roles,
  }) async {
    await _storage.write(key: _keyUserId, value: userId);
    await _storage.write(key: _keyPhone, value: phone);
    if (roles != null) {
      await saveUserRoles(roles);
    }
  }

  Future<void> saveUserRoles(List<String> roles) async {
    await _storage.write(key: _keyRoles, value: roles.join(','));
  }

  Future<List<String>> getUserRoles() async {
    final raw = await _storage.read(key: _keyRoles);
    if (raw == null || raw.trim().isEmpty) return const [];
    return raw
        .split(',')
        .map((r) => r.trim())
        .where((r) => r.isNotEmpty)
        .toList();
  }

  Future<String?> getUserId() async {
    return await _storage.read(key: _keyUserId);
  }

  Future<String?> getPhone() async {
    return await _storage.read(key: _keyPhone);
  }

  // Scoped to the account; clearAll also removes these session preferences.
  Future<String?> getAppMode(String userId) =>
      _storage.read(key: 'app_mode_$userId');

  Future<void> saveAppMode(String userId, String mode) =>
      _storage.write(key: 'app_mode_$userId', value: mode);

  Future<void> deleteAppMode(String userId) =>
      _storage.delete(key: 'app_mode_$userId');

  Future<void> clearAll() async {
    final installationId = await _storage.read(key: _keyInstallationId);
    final pushPermissionExplained = await _storage.read(
      key: _keyPushPermissionExplained,
    );
    await _storage.deleteAll();
    if (installationId != null) {
      await _storage.write(key: _keyInstallationId, value: installationId);
    }
    if (pushPermissionExplained != null) {
      await _storage.write(
        key: _keyPushPermissionExplained,
        value: pushPermissionExplained,
      );
    }
  }

  Future<String> getInstallationId() async {
    final existing = await _storage.read(key: _keyInstallationId);
    if (existing != null && existing.isNotEmpty) return existing;
    final created = UuidUtils.generateV4();
    await _storage.write(key: _keyInstallationId, value: created);
    return created;
  }

  Future<bool> wasPushPermissionExplained() async =>
      await _storage.read(key: _keyPushPermissionExplained) == 'true';

  Future<void> markPushPermissionExplained() =>
      _storage.write(key: _keyPushPermissionExplained, value: 'true');
}

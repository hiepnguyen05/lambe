import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:mobile/core/constants/api_endpoints.dart';
import 'package:mobile/core/storage/secure_storage_service.dart';

class PushDeviceService {
  const PushDeviceService(this.dio, this.storage);

  final Dio dio;
  final SecureStorageService storage;

  bool get _isSupportedPlatform =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  Future<AuthorizationStatus> authorizationStatus() async =>
      (await FirebaseMessaging.instance.getNotificationSettings())
          .authorizationStatus;

  Future<void> register() async {
    if (Firebase.apps.isEmpty || !_isSupportedPlatform) {
      return;
    }
    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission();
    if (settings.authorizationStatus != AuthorizationStatus.authorized &&
        settings.authorizationStatus != AuthorizationStatus.provisional) {
      return;
    }
    if (defaultTargetPlatform == TargetPlatform.iOS &&
        await messaging.getAPNSToken() == null) {
      return;
    }
    final token = await messaging.getToken();
    if (token == null || token.isEmpty) {
      return;
    }
    await registerToken(token);
  }

  Future<void> registerToken(String token) async {
    if (token.isEmpty || !_isSupportedPlatform) {
      return;
    }
    await dio.put<Map<String, dynamic>>(
      ApiEndpoints.mePushDevices,
      data: {
        'platform':
            defaultTargetPlatform == TargetPlatform.iOS ? 'IOS' : 'ANDROID',
        'deviceId': await storage.getInstallationId(),
        'token': token,
        'appVersion': '1.0.0',
      },
    );
  }
}

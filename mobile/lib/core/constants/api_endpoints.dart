class ApiEndpoints {
  ApiEndpoints._();

  // Base URL configuration (Dùng http://localhost:5000/api khi chạy qua USB adb reverse)
  static const String baseUrl = 'http://localhost:5000/api';
  // static const String baseUrl = 'http://10.0.2.2:5000/api'; // Android Emulator

  static const Duration connectionTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);

  // Auth Endpoints
  static const String sendOtp = '/auth/send-otp';
  static const String verifyOtp = '/auth/verify-otp';
  static const String completeRegistration = '/auth/complete-registration';
  static const String me = '/auth/me';

  // Categories & Services
  static const String categories = '/categories';
  static const String services = '/services';
}

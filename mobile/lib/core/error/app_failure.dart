abstract class AppFailure implements Exception {
  final String message;
  final int? statusCode;

  const AppFailure(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class NetworkFailure extends AppFailure {
  const NetworkFailure([
    super.message = 'Không có kết nối Internet hoặc lỗi mạng.',
    super.statusCode,
  ]);
}

class ServerFailure extends AppFailure {
  const ServerFailure([
    super.message = 'Hệ thống gặp sự cố. Vui lòng thử lại sau.',
    super.statusCode,
  ]);
}

class UnauthorizedFailure extends AppFailure {
  const UnauthorizedFailure([
    super.message = 'Phiên đăng nhập đã hết hạn.',
    super.statusCode = 401,
  ]);
}

class ValidationFailure extends AppFailure {
  const ValidationFailure([
    super.message = 'Dữ liệu đầu vào không hợp lệ.',
    super.statusCode = 400,
  ]);
}

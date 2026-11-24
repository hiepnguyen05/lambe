import 'package:intl/intl.dart';

class IncomingOrderEntity {
  final String id;
  final bool isAsap;
  final String serviceName;
  final String serviceDescription;
  final int earningsAmount;
  final int durationMinutes;
  final int arrivalMinutes;
  final String timeWindow;
  final String customerName;
  final String? customerAvatarUrl;
  final bool isVip;
  final double rating;
  final int bookingCount;
  final String address;
  final double? distanceKm;
  final String? customerNote;
  final int countdownSeconds;

  const IncomingOrderEntity({
    required this.id,
    this.isAsap = true,
    required this.serviceName,
    required this.serviceDescription,
    required this.earningsAmount,
    this.durationMinutes = 60,
    this.arrivalMinutes = 20,
    required this.timeWindow,
    required this.customerName,
    this.customerAvatarUrl,
    this.isVip = false,
    this.rating = 5.0,
    this.bookingCount = 1,
    required this.address,
    required this.distanceKm,
    this.customerNote,
    this.countdownSeconds = 30,
  });

  /// Parse dữ liệu thật từ Backend API (GET /api/me/provider/orders?status=PENDING_PROVIDER)
  factory IncomingOrderEntity.fromJson(Map<String, dynamic> json) {
    final isAsap =
        (json['bookingType']?.toString().toUpperCase() ?? 'ASAP') == 'ASAP';
    final serviceName = json['serviceName']?.toString() ?? 'Dịch vụ làm đẹp';

    // Thu nhập thực nhận = Tổng tiền khách trả - Hoa hồng nền tảng
    final totalAmount = (json['totalAmount'] as num?)?.toInt() ?? 0;
    final commission = (json['commissionAmount'] as num?)?.toInt() ?? 0;
    final earningsAmount = (totalAmount - commission).clamp(0, totalAmount);

    final durationMinutes = (json['durationMinutes'] as num?)?.toInt() ?? 60;

    // Thời gian phục vụ dự kiến
    DateTime? startAt;
    DateTime? endAt;
    if (json['expectedStartAt'] != null) {
      startAt = DateTime.tryParse(json['expectedStartAt'].toString())
          ?.toLocal();
    }
    if (json['expectedEndAt'] != null) {
      endAt = DateTime.tryParse(json['expectedEndAt'].toString())?.toLocal();
    }

    final timeWindow = (startAt != null && endAt != null)
        ? '${DateFormat('HH:mm').format(startAt)} – ${DateFormat('HH:mm').format(endAt)}'
        : (startAt != null
              ? DateFormat('HH:mm - dd/MM').format(startAt)
              : 'Làm ngay khi đến');

    int arrivalMinutes = 20;
    if (startAt != null) {
      final diff = startAt.difference(DateTime.now()).inMinutes;
      arrivalMinutes = diff > 0 ? diff : 15;
    }

    // Thông tin khách hàng thực tế từ đơn
    final customerMap = json['customer'] as Map<String, dynamic>?;
    final customerName =
        customerMap?['fullName']?.toString() ??
        json['contactName']?.toString() ??
        'Khách hàng';
    final customerAvatarUrl = customerMap?['avatarUrl']?.toString();

    // Địa chỉ phục vụ
    final address =
        json['addressLine']?.toString() ??
        json['addressStreetLine']?.toString() ??
        json['addressDistrictName']?.toString() ??
        'Tại địa chỉ khách hàng';

    final distanceKm = (json['travelDistanceKm'] as num?)?.toDouble();

    // Thời gian đếm ngược thực tế dựa trên providerResponseDeadlineAt của Backend
    int countdown = 30;
    if (json['providerResponseDeadlineAt'] != null) {
      final deadline = DateTime.tryParse(
        json['providerResponseDeadlineAt'].toString(),
      )?.toLocal();
      if (deadline != null) {
        final remainingSec = deadline.difference(DateTime.now()).inSeconds;
        countdown = remainingSec > 0 ? remainingSec : 30;
      }
    }

    final rawCount = (json['customerOrderCount'] as num?)?.toInt() ?? 1;
    final rawRating = (json['customerRating'] as num?)?.toDouble() ?? 5.0;

    return IncomingOrderEntity(
      id: json['id']?.toString() ?? '',
      isAsap: isAsap,
      serviceName: serviceName,
      serviceDescription:
          json['serviceDescription']?.toString() ??
          'Thời lượng $durationMinutes phút • Thực hiện tại địa chỉ khách hàng',
      earningsAmount: earningsAmount,
      durationMinutes: durationMinutes,
      arrivalMinutes: arrivalMinutes,
      timeWindow: timeWindow,
      customerName: customerName,
      customerAvatarUrl: customerAvatarUrl,
      isVip: json['isVip'] == true || rawCount >= 5,
      rating: rawRating,
      bookingCount: rawCount,
      address: address,
      distanceKm: distanceKm,
      customerNote: json['customerNote']?.toString(),
      countdownSeconds: countdown,
    );
  }
}

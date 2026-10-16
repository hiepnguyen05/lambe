import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../core/constants/api_endpoints.dart';
import '../../../../core/network/api_response_parser.dart';
import '../../../../core/network/dio_client.dart';
import '../../../auth/di/auth_providers.dart';
import '../../domain/entities/booking_draft_entity.dart';
import '../providers/booking_draft_provider.dart';
import '../widgets/booking_step_progress_bar.dart';
import '../widgets/booking_voucher_bottom_sheet.dart';

class BookingConfirmationScreen extends ConsumerStatefulWidget {
  const BookingConfirmationScreen({super.key});

  @override
  ConsumerState<BookingConfirmationScreen> createState() =>
      _BookingConfirmationScreenState();
}

class _BookingConfirmationScreenState
    extends ConsumerState<BookingConfirmationScreen> {
  BookingVoucher? _selectedVoucher;
  final TextEditingController _noteController = TextEditingController();
  final TextEditingController _contactNameController = TextEditingController();
  final TextEditingController _contactPhoneController = TextEditingController();
  bool _isSubmitting = false;
  String? _idempotencyKey;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final draft = ref.read(bookingDraftProvider);
      final user = ref.read(authNotifierProvider).value;

      if (draft != null) {
        _noteController.text = draft.customerNote;
        _contactNameController.text = draft.contactName.isNotEmpty
            ? draft.contactName
            : (user?.fullName ?? '');
        _contactPhoneController.text = draft.contactPhone.isNotEmpty
            ? draft.contactPhone
            : (user?.phone ?? '');
      }
    });
  }

  @override
  void dispose() {
    _noteController.dispose();
    _contactNameController.dispose();
    _contactPhoneController.dispose();
    super.dispose();
  }

  Future<void> _submitOrder(BookingDraftEntity draft) async {
    if (draft.providerServiceId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng chọn chuyên viên trước khi đặt lịch.'),
          backgroundColor: Color(0xFFBA1A1A),
        ),
      );
      return;
    }

    final hasAddress = (draft.addressSource == 'SAVED' && draft.customerAddressId != null) ||
        draft.inlineAddress != null ||
        draft.selectedAddress != null;

    if (!hasAddress) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui lòng cung cấp địa chỉ phục vụ trước khi đặt lịch.'),
          backgroundColor: Color(0xFFBA1A1A),
        ),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    final dio = ref.read(dioProvider);

    final Map<String, dynamic> body = {
      'providerServiceId': draft.providerServiceId,
      'bookingType': draft.bookingType.toApiValue(),
    };

    if (draft.bookingType == BookingType.scheduled && draft.scheduledAt != null) {
      body['scheduledAt'] = draft.scheduledAt!.toUtc().toIso8601String();
    }

    if (draft.addressSource == 'SAVED' && draft.customerAddressId != null) {
      body['customerAddressId'] = draft.customerAddressId;
    } else if (draft.inlineAddress != null) {
      body['inlineAddress'] = draft.inlineAddress!.toJson();
    } else if (draft.selectedAddress != null) {
      body['inlineAddress'] = {
        'addressLine': draft.selectedAddress!.addressLine,
        'latitude': draft.selectedAddress!.latitude,
        'longitude': draft.selectedAddress!.longitude,
      };
    }

    final contactName = _contactNameController.text.trim();
    if (contactName.isNotEmpty) {
      body['contactName'] = contactName;
    }

    final contactPhone = _contactPhoneController.text.trim();
    if (contactPhone.isNotEmpty) {
      body['contactPhone'] = contactPhone;
    }

    final note = _noteController.text.trim();
    String finalNote = note;
    if (_selectedVoucher != null) {
      final voucherTag = '[Voucher: ${_selectedVoucher!.code}]';
      finalNote = finalNote.isEmpty ? voucherTag : '$finalNote $voucherTag';
    }
    if (finalNote.isNotEmpty) {
      body['customerNote'] = finalNote;
    }

    // Tái sử dụng cùng một idempotency-key cho các lần thử lại của phiên này
    _idempotencyKey ??=
        'order_${DateTime.now().millisecondsSinceEpoch}_${draft.providerServiceId!.replaceAll('-', '').substring(0, 8)}';

    try {
      final response = await dio.post(
        ApiEndpoints.orders,
        data: body,
        options: Options(
          headers: {
            'idempotency-key': _idempotencyKey,
          },
        ),
      );

      final data = ApiResponseParser.dataMap(response);
      final orderId = data['id']?.toString() ?? 'LAMBE-${DateTime.now().millisecondsSinceEpoch % 10000}';

      if (mounted) {
        _idempotencyKey = null;
        setState(() {
          _isSubmitting = false;
        });
        _showSuccessDialog(orderId, draft);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });

        String errorMessage = 'Không thể đặt lịch, vui lòng thử lại.';
        if (e is DioException) {
          final resData = e.response?.data;
          if (resData is Map<String, dynamic>) {
            final msg = resData['message'];
            if (msg is String && msg.isNotEmpty) {
              errorMessage = msg;
            } else if (msg is List && msg.isNotEmpty) {
              errorMessage = msg.first.toString();
            }
          } else if (e.type == DioExceptionType.connectionTimeout ||
              e.type == DioExceptionType.receiveTimeout) {
            errorMessage = 'Kết nối mạng quá thời gian. Vui lòng bấm thử lại.';
          }
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
            backgroundColor: const Color(0xFFBA1A1A),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _showSuccessDialog(String orderId, BookingDraftEntity draft) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFFE6F4F1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: Color(0xFF0F766E),
                size: 38,
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              'Gửi yêu cầu thành công!',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Yêu cầu dịch vụ ${draft.service.name} đã được gửi tới chuyên viên ${draft.providerDisplayName ?? ''}.',
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                height: 1.4,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Mã đơn: ',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  Text(
                    orderId.length > 12 ? orderId.substring(0, 12).toUpperCase() : orderId.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0F766E),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: () {
                  ref.read(bookingDraftProvider.notifier).reset();
                  Navigator.of(ctx).pop();
                  context.go('/home');
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  'Về trang chủ',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final draft = ref.watch(bookingDraftProvider);

    if (draft == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Xác nhận đặt lịch')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Phiên đặt lịch đã hết hạn hoặc chưa có thông tin.'),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => context.go('/home'),
                child: const Text('Quay lại trang chủ'),
              ),
            ],
          ),
        ),
      );
    }

    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    final servicePrice = draft.providerPriceAmount ?? draft.service.minPriceAmount;

    // Tính phí di chuyển: <= 3km miễn phí, > 3km tính 5.000đ/km vượt (làm tròn lên 1.000đ)
    final distanceKm = draft.providerDistanceKm ?? 0.0;
    final int baseTravelFee = distanceKm <= 3.0
        ? 0
        : ((((distanceKm - 3.0) * 5000) / 1000).ceil() * 1000);

    // Tính mức giảm giá Voucher
    int voucherDiscount = 0;
    if (_selectedVoucher != null) {
      if (_selectedVoucher!.isFreeShipping) {
        voucherDiscount = baseTravelFee;
      } else {
        voucherDiscount = _selectedVoucher!.discountAmount;
      }
      if (voucherDiscount > servicePrice + baseTravelFee) {
        voucherDiscount = servicePrice + baseTravelFee;
      }
    }

    final totalAmount = (servicePrice + baseTravelFee - voucherDiscount).clamp(0, 999999999).toInt();

    final isAsap = draft.bookingType == BookingType.asap;
    final addressText = draft.selectedAddress?.addressLine ??
        draft.inlineAddress?.addressLine ??
        'Địa chỉ hiện tại của bạn';

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        title: const Text(
          'Xác nhận đặt lịch',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0B1C30),
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            size: 20,
            color: Color(0xFF0B1C30),
          ),
          onPressed: () => context.pop(),
        ),
        bottom: const BookingStepProgressBar(currentStep: 3),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        children: [
          // 1. Card Chuyên viên đã chọn
          _buildCard(
            title: 'Chuyên viên phục vụ',
            icon: Icons.person_pin_rounded,
            trailingAction: TextButton(
              onPressed: () => context.pop(),
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                'Đổi thợ',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F766E),
                ),
              ),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    width: 46,
                    height: 46,
                    color: const Color(0xFFF1F5F9),
                    child: draft.providerAvatarUrl != null &&
                            draft.providerAvatarUrl!.startsWith('http')
                        ? Image.network(
                            draft.providerAvatarUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.person,
                              color: Color(0xFF94A3B8),
                            ),
                          )
                        : const Icon(
                            Icons.person,
                            color: Color(0xFF94A3B8),
                          ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        draft.providerDisplayName ?? 'Chuyên viên Lambe',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 3),
                      const Row(
                        children: [
                          Icon(
                            Icons.verified_rounded,
                            size: 14,
                            color: Color(0xFF0F766E),
                          ),
                          SizedBox(width: 4),
                          Text(
                            'Chuyên viên đối tác đã duyệt',
                            style: TextStyle(
                              fontSize: 11.5,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 2. Card Chi tiết Dịch vụ & Thời gian
          _buildCard(
            title: 'Thông tin dịch vụ & Thời gian',
            icon: Icons.spa_rounded,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        draft.service.name,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    Text(
                      currencyFormatter.format(servicePrice),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Thời lượng thực hiện: ${draft.service.defaultDurationMinutes} phút',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isAsap
                        ? const Color(0xFFFEF3C7)
                        : const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isAsap
                            ? Icons.bolt_rounded
                            : Icons.calendar_month_rounded,
                        size: 18,
                        color: isAsap
                            ? const Color(0xFF92400E)
                            : const Color(0xFF0F766E),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          isAsap
                              ? 'Phục vụ làm ngay (ASAP): Chuyên viên di chuyển đến bạn ngay khi nhận đơn.'
                              : 'Lịch hẹn: ${draft.scheduledAt != null ? DateFormat('HH:mm - EEEE, dd/MM/yyyy').format(draft.scheduledAt!) : 'Hẹn trước'}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: isAsap
                                ? const Color(0xFF92400E)
                                : const Color(0xFF0F766E),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 3. Card Địa chỉ & Liên hệ
          _buildCard(
            title: 'Địa chỉ & Người nhận',
            icon: Icons.location_on_rounded,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.place_outlined,
                      size: 18,
                      color: Color(0xFF64748B),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        addressText,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _contactNameController,
                        style: const TextStyle(fontSize: 13),
                        decoration: InputDecoration(
                          labelText: 'Người liên hệ',
                          labelStyle: const TextStyle(fontSize: 12),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _contactPhoneController,
                        style: const TextStyle(fontSize: 13),
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                          labelText: 'Số điện thoại',
                          labelStyle: const TextStyle(fontSize: 12),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(8),
                            borderSide: const BorderSide(
                              color: Color(0xFFE2E8F0),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _noteController,
                  style: const TextStyle(fontSize: 12.5),
                  decoration: InputDecoration(
                    hintText: 'Ghi chú cho thợ (số nhà, chuông cửa, ngõ...)',
                    hintStyle: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF94A3B8),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 8,
                    ),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 4. Card Phương thức thanh toán (Tiền mặt COD duy nhất)
          _buildCard(
            title: 'Phương thức thanh toán',
            icon: Icons.account_balance_wallet_rounded,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6F5),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF0F766E), width: 1.2),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F766E).withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.payments_rounded,
                      size: 20,
                      color: Color(0xFF0F766E),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Tiền mặt (COD)',
                          style: TextStyle(
                            fontSize: 13.5,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F766E),
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Thanh toán trực tiếp cho chuyên viên sau khi làm xong',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.check_circle_rounded,
                    size: 22,
                    color: Color(0xFF0F766E),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // 5. Card Ưu đãi & Voucher
          _buildCard(
            title: 'Ưu đãi & Voucher',
            icon: Icons.local_offer_rounded,
            trailingAction: _selectedVoucher != null
                ? InkWell(
                    onTap: () {
                      setState(() {
                        _selectedVoucher = null;
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Đã gỡ mã ưu đãi'),
                          duration: Duration(seconds: 1),
                        ),
                      );
                    },
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      child: Text(
                        'Gỡ bỏ',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFDC2626),
                        ),
                      ),
                    ),
                  )
                : null,
            child: InkWell(
              onTap: () {
                BookingVoucherBottomSheet.show(
                  context,
                  servicePrice: servicePrice,
                  travelFee: baseTravelFee,
                  currentVoucher: _selectedVoucher,
                  onVoucherSelected: (voucher) {
                    setState(() {
                      _selectedVoucher = voucher;
                    });
                  },
                );
              },
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: _selectedVoucher != null
                      ? const Color(0xFFFFF7ED)
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: _selectedVoucher != null
                        ? const Color(0xFFFDBA74)
                        : const Color(0xFFE2E8F0),
                    width: 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(7),
                      decoration: BoxDecoration(
                        color: _selectedVoucher != null
                            ? const Color(0xFFEA580C).withValues(alpha: 0.12)
                            : const Color(0xFFE2E8F0),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.confirmation_num_outlined,
                        size: 18,
                        color: _selectedVoucher != null
                            ? const Color(0xFFEA580C)
                            : const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _selectedVoucher == null
                          ? const Text(
                              'Chọn hoặc nhập mã ưu đãi / voucher',
                              style: TextStyle(
                                fontSize: 12.5,
                                color: Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 1.5,
                                      ),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFEA580C),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        _selectedVoucher!.code,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        _selectedVoucher!.title,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFFC2410C),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _selectedVoucher!.isFreeShipping
                                      ? 'Miễn phí di chuyển (${currencyFormatter.format(baseTravelFee)})'
                                      : 'Đã giảm ${currencyFormatter.format(voucherDiscount)} vào đơn',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF78350F),
                                  ),
                                ),
                              ],
                            ),
                    ),
                    const Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 14,
                      color: Color(0xFF94A3B8),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),

          // 6. Card Chi tiết thanh toán
          _buildCard(
            title: 'Chi tiết thanh toán',
            icon: Icons.receipt_long_rounded,
            child: Column(
              children: [
                _buildPriceRow('Giá dịch vụ', currencyFormatter.format(servicePrice)),
                const SizedBox(height: 6),
                _buildPriceRow(
                  baseTravelFee == 0
                      ? 'Phí di chuyển (< 3km)'
                      : 'Phí di chuyển (${distanceKm.toStringAsFixed(1)} km)',
                  baseTravelFee == 0
                      ? 'Miễn phí'
                      : currencyFormatter.format(baseTravelFee),
                  valueColor: baseTravelFee == 0
                      ? const Color(0xFF16A34A)
                      : const Color(0xFF1E293B),
                ),
                const SizedBox(height: 6),
                _buildPriceRow(
                  _selectedVoucher != null
                      ? 'Ưu đãi voucher (${_selectedVoucher!.code})'
                      : 'Ưu đãi / Giảm giá',
                  voucherDiscount > 0
                      ? '- ${currencyFormatter.format(voucherDiscount)}'
                      : '- 0 đ',
                  valueColor: voucherDiscount > 0
                      ? const Color(0xFFEA580C)
                      : const Color(0xFF64748B),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 8),
                  child: Divider(height: 1, color: Color(0xFFE2E8F0)),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Tổng thanh toán',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    Text(
                      currencyFormatter.format(totalAmount),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 80),
        ],
      ),

      // Bottom Sticky Confirmation Bar
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(
          16,
          10,
          16,
          MediaQuery.of(context).padding.bottom + 10,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          border: const Border(
            top: BorderSide(color: Color(0xFFE2E8F0), width: 1),
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF0F172A).withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: Row(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text(
                      'Tổng tiền',
                      style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                    if (voucherDiscount > 0) ...[
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF3C7),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '-${currencyFormatter.format(voucherDiscount)}',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFB45309),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                Text(
                  currencyFormatter.format(totalAmount),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F766E),
                  ),
                ),
              ],
            ),
            const SizedBox(width: 16),
            Expanded(
              child: SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : () => _submitOrder(draft),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'Xác nhận đặt lịch',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCard({
    required String title,
    required IconData icon,
    required Widget child,
    Widget? trailingAction,
  }) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 17, color: const Color(0xFF0F766E)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
              ),
              if (trailingAction != null) trailingAction,
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }

  Widget _buildPriceRow(String label, String value, {Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: valueColor ?? const Color(0xFF1E293B),
          ),
        ),
      ],
    );
  }
}


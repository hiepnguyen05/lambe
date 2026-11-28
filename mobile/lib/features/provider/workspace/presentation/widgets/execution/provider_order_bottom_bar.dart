import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/order_countdown.dart';

class ProviderOrderBottomBar extends StatelessWidget {
  final String status;
  final String bookingType;
  final DateTime? departureAvailableAt;
  final DateTime? scheduledAt;
  final bool hasBefore;
  final bool hasAfter;
  final String? cancellationStatus;
  final bool isActionLoading;
  final bool canMarkArrived;
  final int? distanceMetersToCustomer;
  final VoidCallback onReject;
  final VoidCallback onAccept;
  final VoidCallback onStartTravel;
  final VoidCallback? onCancelOrder;
  final VoidCallback onMarkArrived;
  final VoidCallback onStartOrder;
  final VoidCallback? onFinishService;

  const ProviderOrderBottomBar({
    super.key,
    required this.status,
    this.bookingType = 'ASAP',
    this.departureAvailableAt,
    this.scheduledAt,
    required this.hasBefore,
    this.hasAfter = false,
    required this.cancellationStatus,
    required this.isActionLoading,
    this.canMarkArrived = true,
    this.distanceMetersToCustomer,
    required this.onReject,
    required this.onAccept,
    required this.onStartTravel,
    this.onCancelOrder,
    required this.onMarkArrived,
    required this.onStartOrder,
    this.onFinishService,
  });

  @override
  Widget build(BuildContext context) {
    if (cancellationStatus == 'PENDING_CUSTOMER' ||
        cancellationStatus == 'SUPPORT_REVIEW') {
      return Container(
        padding: EdgeInsets.fromLTRB(
          16,
          12,
          16,
          MediaQuery.of(context).padding.bottom + 12,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(0xFFFEF2F2),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFFECACA)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.hourglass_empty_rounded,
                size: 20,
                color: Color(0xFFDC2626),
              ),
              const SizedBox(width: 8),
              Flexible(
                child: Text(
                  cancellationStatus == 'SUPPORT_REVIEW'
                      ? 'Đang chờ bộ phận hỗ trợ xử lý...'
                      : 'Đang chờ khách hàng phản hồi yêu cầu hủy...',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF991B1B),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (status == 'PENDING_PROVIDER') {
      return Container(
        padding: EdgeInsets.fromLTRB(
          16,
          12,
          16,
          MediaQuery.of(context).padding.bottom + 12,
        ),
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
          boxShadow: [
            BoxShadow(
              color: Color(0x0A000000),
              blurRadius: 10,
              offset: Offset(0, -4),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 52,
                child: OutlinedButton(
                  onPressed: isActionLoading ? null : onReject,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFDC2626),
                    side: const BorderSide(color: Color(0xFFFECACA)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: const Text(
                    'Từ chối',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 2,
              child: SizedBox(
                height: 52,
                child: ElevatedButton(
                  onPressed: isActionLoading ? null : onAccept,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 3,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: isActionLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.2,
                            color: Colors.white,
                          ),
                        )
                      : const Text(
                          'Nhận đơn ngay',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (status == 'ACCEPTED') {
      Widget departure(bool waiting, {bool expired = false}) => _buildBar(
        context,
        hint: expired
            ? 'Thống nhất giờ hẹn mới với khách trước khi khởi hành.'
            : waiting
            ? departureAvailableAt == null || scheduledAt == null
                  ? 'Tải lại đơn để kiểm tra thời điểm được khởi hành.'
                  : 'Có thể khởi hành từ ${DateFormat('HH:mm · dd/MM').format(departureAvailableAt!.toLocal())}'
            : null,
        primary: ElevatedButton.icon(
          onPressed: isActionLoading || waiting || expired
              ? null
              : onStartTravel,
          icon: isActionLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.two_wheeler_rounded, size: 22),
          label: Text(
            isActionLoading
                ? 'Đang cập nhật...'
                : expired
                ? 'Lịch hẹn đã quá giờ'
                : waiting
                ? 'Chưa đến giờ khởi hành'
                : 'Bắt đầu di chuyển',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primaryContainer,
            foregroundColor: Colors.white,
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      );
      if (bookingType == 'SCHEDULED' &&
          departureAvailableAt != null &&
          scheduledAt != null) {
        return OrderCountdown(
          deadline: scheduledAt!,
          builder: (_, remaining) => departure(
            DateTime.now().isBefore(departureAvailableAt!),
            expired: remaining == Duration.zero,
          ),
        );
      }
      return departure(bookingType == 'SCHEDULED');
    }

    if (status == 'EN_ROUTE') {
      final distanceLabel = distanceMetersToCustomer == null
          ? 'Đang kiểm tra vị trí của bạn...'
          : distanceMetersToCustomer! >= 1000
          ? 'Cách khách ${(distanceMetersToCustomer! / 1000).toStringAsFixed(1)} km · cần đến trong 300 m'
          : 'Cách khách $distanceMetersToCustomer m · cần đến trong 300 m';
      return _buildBar(
        context,
        hint: canMarkArrived ? null : distanceLabel,
        primary: ElevatedButton.icon(
          onPressed: (isActionLoading || !canMarkArrived)
              ? null
              : onMarkArrived,
          icon: isActionLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : const Icon(Icons.check_circle_rounded, size: 22),
          label: Text(
            isActionLoading ? 'Đang xác nhận...' : 'Xác nhận đã đến nơi',
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            disabledBackgroundColor: const Color(0xFFCBD5E1),
            disabledForegroundColor: const Color(0xFF64748B),
            elevation: canMarkArrived ? 2 : 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      );
    }

    if (status == 'ARRIVED') {
      return _buildBar(
        context,
        primary: ElevatedButton.icon(
          onPressed: isActionLoading ? null : onStartOrder,
          icon: isActionLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Icon(
                  hasBefore
                      ? Icons.play_arrow_rounded
                      : Icons.camera_alt_rounded,
                  size: 22,
                ),
          label: Text(
            isActionLoading
                ? (hasBefore ? 'Đang bắt đầu...' : 'Đang tải ảnh...')
                : (hasBefore ? 'Bắt đầu làm việc' : 'Chụp ảnh trước khi làm'),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      );
    }

    if (status == 'IN_PROGRESS' && onFinishService != null) {
      return _buildBar(
        context,
        primary: ElevatedButton.icon(
          onPressed: isActionLoading ? null : onFinishService,
          icon: isActionLoading
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: Colors.white,
                  ),
                )
              : Icon(
                  hasAfter
                      ? Icons.receipt_long_rounded
                      : Icons.camera_alt_rounded,
                  size: 22,
                ),
          label: Text(
            isActionLoading
                ? (hasAfter ? 'Đang xử lý...' : 'Đang tải ảnh...')
                : (hasAfter
                      ? 'Thanh toán & Hoàn tất'
                      : 'Hoàn tất & Chụp ảnh kết quả'),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              letterSpacing: 0,
            ),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildBar(
    BuildContext context, {
    required Widget primary,
    String? hint,
  }) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        10,
        16,
        MediaQuery.of(context).padding.bottom + 12,
      ),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 10,
            offset: Offset(0, -4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hint != null) ...[
            Text(
              hint,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFFD97706),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
          ],
          SizedBox(width: double.infinity, height: 52, child: primary),
          if (onCancelOrder != null) ...[
            const SizedBox(height: 4),
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                onPressed: isActionLoading ? null : onCancelOrder,
                icon: const Icon(Icons.cancel_outlined, size: 18),
                label: Text(
                  status == 'ACCEPTED'
                      ? bookingType == 'SCHEDULED'
                            ? 'Hủy lịch hẹn'
                            : 'Hủy đơn'
                      : 'Yêu cầu hủy đơn',
                ),
                style: TextButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.error,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

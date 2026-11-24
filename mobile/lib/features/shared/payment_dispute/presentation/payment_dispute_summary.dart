import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../domain/payment_dispute_order.dart';

final _money = NumberFormat.decimalPattern('vi_VN');
final _date = DateFormat('HH:mm · dd/MM/yyyy');

class PaymentDisputeSummary extends StatelessWidget {
  final PaymentDisputeOrder order;
  final PaymentDisputeRole role;
  const PaymentDisputeSummary({
    super.key,
    required this.order,
    required this.role,
  });
  String amount(int value) =>
      '${_money.format(value)} ${order.currency == 'VND' ? 'đ' : order.currency}';
  String date(DateTime value) =>
      '${_date.format(value.toUtc().add(const Duration(hours: 7)))} (giờ Việt Nam)';
  @override
  Widget build(BuildContext context) {
    final confirmedUnpaid = order.status == 'DISPUTED';
    final paid = order.status == 'COMPLETED' && order.hasHistory;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              paid
                  ? 'Đã xác minh thanh toán'
                  : confirmedUnpaid
                  ? 'Đã xác minh chưa thanh toán'
                  : 'Đang chờ xác minh thanh toán',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 12),
            Text('Tổng tiền của đơn: ${amount(order.totalAmount)}'),
            if (order.reason?.isNotEmpty == true)
              Text('Nội dung thợ báo cáo: ${order.reason}'),
            if (order.openedAt != null)
              Text('Gửi lúc: ${date(order.openedAt!)}'),
            if (order.decidedAt != null)
              Text('Cập nhật đối soát: ${date(order.decidedAt!)}'),
            const SizedBox(height: 12),
            Text(
              paid
                  ? 'Đơn đã được hệ thống chuyển sang hoàn thành sau xác minh.'
                  : confirmedUnpaid
                  ? 'Khoản chưa thanh toán tiếp tục chờ thu hồi hoặc xử lý thủ công. Đơn chưa hoàn thành.'
                  : 'Báo cáo đang chờ bộ phận hỗ trợ xác minh; chưa có kết luận về việc thanh toán.',
            ),
            if (role == PaymentDisputeRole.provider) ...[
              const Divider(),
              if (order.hold == null)
                const Text('Chưa có thông tin khoản tạm giữ. Vui lòng tải lại.')
              else
                Text(switch (order.hold!.status) {
                  'ACTIVE' =>
                    'Hoa hồng đang tạm giữ: ${amount(order.hold!.amount)}',
                  'CAPTURED' =>
                    'Hoa hồng đã khấu trừ: ${amount(order.hold!.amount)}',
                  _ =>
                    'Khoản tạm giữ đã giải phóng: ${amount(order.hold!.amount)}',
                }),
              if (order.hold?.status == 'ACTIVE')
                const Text(
                  'Khoản này chưa được khấu trừ. Ứng dụng không tự giải phóng hoặc hoàn lại.',
                ),
            ] else if (!paid)
              const Text(
                'Hoa hồng của đơn tiếp tục được tạm giữ trong quy trình xử lý.',
              ),
            if (!paid)
              const Text(
                'Chưa thể đánh giá dịch vụ khi đơn còn tranh chấp thanh toán.',
              ),
          ],
        ),
      ),
    );
  }
}

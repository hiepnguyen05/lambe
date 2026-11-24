import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../providers/organization_receiving_notifier.dart';

class OrganizationEmergencyReceivingTile extends ConsumerWidget {
  const OrganizationEmergencyReceivingTile({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(organizationReceivingProvider);
    final isEnabled = state.isEnabled;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isEnabled ? Colors.white : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isEnabled ? const Color(0xFFE5E7EB) : const Color(0xFFFDE68A),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isEnabled
                  ? const Color(0xFFD1FAE5)
                  : const Color(0xFFFEE2E2),
              shape: BoxShape.circle,
            ),
            child: Icon(
              isEnabled
                  ? Icons.notifications_active_rounded
                  : Icons.notifications_off_rounded,
              color: isEnabled
                  ? const Color(0xFF059669)
                  : const Color(0xFFDC2626),
              size: 22,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Nhận đơn toàn cơ sở',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0B1C30),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  isEnabled
                      ? 'Đang mở nhận đơn cho tất cả nhân viên'
                      : 'Đang tạm dừng nhận đơn khẩn cấp toàn bộ',
                  style: TextStyle(
                    fontSize: 12,
                    color: isEnabled
                        ? const Color(0xFF059669)
                        : const Color(0xFFDC2626),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: isEnabled,
            activeThumbColor: AppColors.primary,
            onChanged: state.isToggling
                ? null
                : (value) => _confirmToggle(context, ref, value),
          ),
        ],
      ),
    );
  }

  void _confirmToggle(BuildContext context, WidgetRef ref, bool newValue) {
    final reasonCtrl = TextEditingController(
      text: newValue
          ? 'Mở lại hoạt động tiếp nhận đơn toàn cơ sở'
          : 'Tạm dừng khẩn cấp nhận đơn toàn bộ thợ',
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          newValue
              ? 'Mở lại nhận đơn toàn cơ sở?'
              : 'Tạm dừng nhận đơn toàn cơ sở?',
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              newValue
                  ? 'Nhân viên sẽ có thể bật online và tiếp tục nhận các đơn đặt lịch mới.'
                  : 'Cảnh báo: Toàn bộ nhân viên sẽ bị tắt trực tuyến ngay lập tức. Các đơn đang thực hiện vẫn tiếp tục.',
              style: const TextStyle(fontSize: 13, color: Color(0xFF4B5563)),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Lý do thay đổi (*)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Hủy'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  newValue ? AppColors.primary : const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref
                  .read(organizationReceivingProvider.notifier)
                  .toggleReceiving(
                    enabled: newValue,
                    reason: reasonCtrl.text,
                  );
            },
            child: const Text('Xác nhận'),
          ),
        ],
      ),
    );
  }
}

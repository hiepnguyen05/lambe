import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../di/provider_services_providers.dart';
import '../../domain/provider_offering.dart';
import '../widgets/service_async_message.dart';
import '../widgets/service_format.dart';

class ProviderServiceDetailScreen extends ConsumerWidget {
  final String id;
  const ProviderServiceDetailScreen({super.key, required this.id});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(providerOfferingProvider(id));
    final controller = ref.read(providerOfferingProvider(id).notifier);
    final offering = state.value;
    Future<void> toggle() async {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(
            offering!.active ? 'Tạm ngừng dịch vụ?' : 'Bật cung cấp dịch vụ?',
          ),
          content: Text(
            offering.active
                ? 'Chỉ dừng đơn mới; đơn đã nhận không thay đổi. Cần phản hồi đơn đặt ngay đang chờ trước. Nếu đây là dịch vụ hợp lệ cuối cùng, trạng thái online sẽ kết thúc.'
                : 'Hệ thống sẽ kiểm tra dịch vụ, danh mục, giá và thiết lập đối tác. Bật dịch vụ không tự bật online.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Quay lại'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Xác nhận'),
            ),
          ],
        ),
      );
      if (confirmed != true || !context.mounted) return;
      final success = await controller.setActive(!offering!.active);
      if (success && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã cập nhật trạng thái dịch vụ.')),
        );
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết dịch vụ')),
      body: RefreshIndicator(
        onRefresh: controller.load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            SizedBox(
              height: 3,
              child: state.busy ? const LinearProgressIndicator() : null,
            ),
            if (state.error != null)
              ServiceAsyncMessage(
                message: state.error!,
                retry: state.busy ? null : controller.load,
              ),
            if (offering != null) ...[
              Text(
                offering.service.name,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Text(offering.service.category.name),
              const SizedBox(height: 16),
              Text('Giá đang cung cấp: ${serviceMoney(offering.price)}'),
              Text(
                'Giá sàn/trần: ${serviceMoney(offering.service.minPrice)} – ${serviceMoney(offering.service.maxPrice)}',
              ),
              Text(
                'Thời lượng: ${offering.effectiveDuration == null ? 'Chưa có thông tin' : '${offering.effectiveDuration} phút'}',
              ),
              Text(
                'Trạng thái: ${offering.suspended
                    ? 'Đình chỉ'
                    : offering.active
                    ? 'Đang bật'
                    : 'Tạm ngừng'}',
              ),
              if (offering.description != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(offering.description!),
                ),
              if (offering.blockerCode != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(offeringBlockerLabel(offering.blockerCode)),
                ),
              if (offering.suspensionReason != null)
                Text('Lý do đình chỉ: ${offering.suspensionReason}'),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: state.blocked || !offering.canToggle ? null : toggle,
                child: Text(
                  offering.active
                      ? 'Tạm ngừng nhận đơn mới'
                      : 'Bật cung cấp dịch vụ',
                ),
              ),
              OutlinedButton.icon(
                onPressed: state.blocked
                    ? null
                    : () => context.push(
                        '/provider/service-changes/new?offeringId=${offering.id}',
                      ),
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Đề xuất sửa giá / thời lượng'),
              ),
              const Text(
                'Thay đổi giá, thời lượng và mô tả cần kiểm duyệt. Đơn đã đặt giữ nguyên giá đã chốt.',
              ),
            ] else if (!state.busy && state.error == null)
              ServiceAsyncMessage(
                message: 'Chưa đọc được dịch vụ.',
                retry: controller.load,
              ),
          ],
        ),
      ),
    );
  }
}

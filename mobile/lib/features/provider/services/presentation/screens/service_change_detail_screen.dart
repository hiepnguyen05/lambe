import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../di/provider_services_providers.dart';
import '../../domain/service_change.dart';
import '../widgets/service_async_message.dart';
import '../widgets/service_change_documents.dart';
import '../widgets/service_format.dart';

class ServiceChangeDetailScreen extends ConsumerStatefulWidget {
  final String id;
  const ServiceChangeDetailScreen({super.key, required this.id});
  @override
  ConsumerState<ServiceChangeDetailScreen> createState() =>
      _ServiceChangeDetailScreenState();
}

class _ServiceChangeDetailScreenState
    extends ConsumerState<ServiceChangeDetailScreen>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        ModalRoute.of(context)?.isCurrent == true) {
      ref.read(serviceChangeProvider(widget.id).notifier).load();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _confirm(bool withdraw) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(withdraw ? 'Rút đề xuất?' : 'Gửi kiểm duyệt?'),
        content: Text(
          withdraw
              ? 'Đề xuất sẽ kết thúc và không thể gửi lại cùng bản này. Dịch vụ đã được duyệt trước đó không bị xóa.'
              : 'Khi gửi, bạn không thể sửa thông tin hoặc tài liệu trong lúc chờ kiểm duyệt. Dịch vụ đang có chỉ thay đổi sau khi duyệt.',
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
    if (confirmed != true || !mounted) return;
    final controller = ref.read(serviceChangeProvider(widget.id).notifier);
    final success = withdraw
        ? await controller.withdraw()
        : await controller.submit();
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            withdraw ? 'Đã rút đề xuất.' : 'Đã gửi; đang chờ kiểm duyệt.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(serviceChangeProvider(widget.id));
    final controller = ref.read(serviceChangeProvider(widget.id).notifier);
    final request = state.value;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đề xuất dịch vụ'),
        actions: [
          IconButton(
            tooltip: 'Tải lại',
            onPressed: state.busy ? null : controller.load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
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
            if (request != null) ...[
              Text(
                request.name,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              Text(request.type.label),
              const SizedBox(height: 12),
              Text(
                'Trạng thái: ${request.status.label}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Text('Giá đề xuất: ${serviceMoney(request.price)}'),
              Text(
                'Thời lượng đề xuất: ${request.duration == null ? 'Theo mặc định dịch vụ chuẩn' : '${request.duration} phút'}',
              ),
              if (request.category?.name ?? request.service?.category.name
                  case final String category)
                Text('Danh mục: $category'),
              if (request.description != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Text(request.description!),
                ),
              if (request.reviewNote != null)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text('Phản hồi kiểm duyệt: ${request.reviewNote}'),
                  ),
                ),
              if (request.submittedAt != null)
                Text('Gửi lúc: ${serviceTime(request.submittedAt!)}'),
              if (request.reviewedAt != null)
                Text('Kiểm duyệt lúc: ${serviceTime(request.reviewedAt!)}'),
              const SizedBox(height: 16),
              ServiceChangeDocuments(request: request, disabled: state.blocked),
              if (request.editable) ...[
                OutlinedButton.icon(
                  onPressed: state.blocked
                      ? null
                      : () => context.push(
                          '/provider/service-changes/${request.id}/edit',
                        ),
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Sửa thông tin bản nháp'),
                ),
                FilledButton(
                  onPressed: state.blocked ? null : () => _confirm(false),
                  child: Text(
                    request.status == ServiceChangeStatus.needsChanges
                        ? 'Gửi lại kiểm duyệt'
                        : 'Gửi kiểm duyệt',
                  ),
                ),
              ],
              if (request.canWithdraw)
                TextButton(
                  onPressed: state.blocked ? null : () => _confirm(true),
                  child: const Text('Rút đề xuất'),
                ),
              if (request.status == ServiceChangeStatus.approved)
                const Text(
                  'Đề xuất đã được duyệt. Dịch vụ mới bắt đầu ở trạng thái tạm ngừng; kiểm tra và tự bật trong Dịch vụ của tôi.',
                ),
              if (request.status == ServiceChangeStatus.rejected ||
                  request.status == ServiceChangeStatus.withdrawn)
                OutlinedButton(
                  onPressed: state.blocked
                      ? null
                      : () => context.push(
                          '/provider/service-changes/new${request.offeringId == null ? '' : '?offeringId=${request.offeringId}'}',
                        ),
                  child: const Text('Tạo đề xuất mới'),
                ),
              TextButton(
                onPressed: () => context.go('/provider/services'),
                child: const Text('Xem dịch vụ của tôi'),
              ),
            ] else if (!state.busy && state.error == null)
              ServiceAsyncMessage(
                message: 'Chưa tải được đề xuất.',
                retry: controller.load,
              ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../application/service_operation.dart';
import '../../di/provider_services_providers.dart';
import '../widgets/service_async_message.dart';
import '../widgets/service_change_form.dart';

class ServiceChangeEditorScreen extends ConsumerWidget {
  final String? requestId, offeringId;
  const ServiceChangeEditorScreen({super.key, this.requestId, this.offeringId});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final id = requestId;
    final options = ref.watch(serviceEditorOptionsProvider);
    final state = id == null
        ? ref.watch(newServiceChangeProvider(offeringId))
        : ref.watch(serviceChangeProvider(id));
    final current = id == null ? null : state.value;
    return Scaffold(
      appBar: AppBar(
        title: Text(id == null ? 'Tạo đề xuất dịch vụ' : 'Sửa bản nháp'),
      ),
      body: options.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => ListView(
          children: [
            ServiceAsyncMessage(
              message: serviceError(error),
              retry: () => ref.invalidate(serviceEditorOptionsProvider),
            ),
          ],
        ),
        data: (options) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            SizedBox(
              height: 3,
              child: state.busy ? const LinearProgressIndicator() : null,
            ),
            if (state.error != null)
              ServiceAsyncMessage(
                message: state.error!,
                retry: id != null && !state.busy
                    ? () => ref.read(serviceChangeProvider(id).notifier).load()
                    : null,
              ),
            if (id != null && current == null) ...[
              if (!state.busy)
                ServiceAsyncMessage(
                  message: 'Chưa tải được đề xuất.',
                  retry: () =>
                      ref.read(serviceChangeProvider(id).notifier).load(),
                ),
            ] else if (current != null && !current.editable) ...[
              Text(
                'Đề xuất ${current.status.label.toLowerCase()}, không còn được sửa.',
              ),
              TextButton(
                onPressed: () => context.go('/provider/service-changes/$id'),
                child: const Text('Xem trạng thái hiện tại'),
              ),
            ] else ...[
              if (state.uncertain && id == null) ...[
                const Text(
                  'Chưa rõ bản nháp đã được tạo hay chưa. Không tự gửi lại để tránh tạo trùng.',
                ),
                OutlinedButton(
                  onPressed: state.busy
                      ? null
                      : () async {
                          final found = await ref
                              .read(
                                newServiceChangeProvider(offeringId).notifier,
                              )
                              .recover();
                          if (found != null && context.mounted) {
                            context.pushReplacement(
                              '/provider/service-changes/${found.id}',
                            );
                          }
                        },
                  child: const Text('Kiểm tra kết quả tạo đề xuất'),
                ),
              ],
              if (id == null && state.value != null)
                TextButton(
                  onPressed: () => context.pushReplacement(
                    '/provider/service-changes/${state.value!.id}',
                  ),
                  child: const Text('Mở đề xuất đã lưu'),
                ),
              ServiceChangeForm(
                key: ValueKey(
                  '${id ?? 'new'}:${current?.updatedAt.toIso8601String() ?? ''}',
                ),
                options: options,
                existing: current,
                offeringId: offeringId,
                disabled: state.blocked || (id == null && state.value != null),
                onSave: (draft, definition) async {
                  if (id == null) {
                    final result = await ref
                        .read(newServiceChangeProvider(offeringId).notifier)
                        .create(draft, definition);
                    if (result != null && context.mounted) {
                      context.pushReplacement(
                        '/provider/service-changes/${result.id}',
                      );
                    }
                  } else {
                    final success = await ref
                        .read(serviceChangeProvider(id).notifier)
                        .update(draft, current!.updatedAt);
                    if (success && context.mounted) {
                      context.canPop()
                          ? context.pop()
                          : context.go('/provider/service-changes/$id');
                    }
                  }
                },
              ),
              TextButton(
                onPressed: state.busy
                    ? null
                    : () => context.go('/provider/services?tab=changes'),
                child: const Text('Xem các đề xuất của tôi'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

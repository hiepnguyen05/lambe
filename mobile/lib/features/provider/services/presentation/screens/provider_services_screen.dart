import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../di/provider_services_providers.dart';
import '../../domain/service_change.dart';
import '../../application/service_operation.dart';
import '../widgets/provider_offering_tile.dart';
import '../widgets/service_request_tile.dart';
import '../widgets/service_async_message.dart';

class ProviderServicesScreen extends ConsumerStatefulWidget {
  final int initialTab;
  const ProviderServicesScreen({super.key, this.initialTab = 0});
  @override
  ConsumerState<ProviderServicesScreen> createState() =>
      _ProviderServicesScreenState();
}

class _ProviderServicesScreenState extends ConsumerState<ProviderServicesScreen>
    with WidgetsBindingObserver {
  ServiceChangeStatus? _filter;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        ModalRoute.of(context)?.isCurrent == true) {
      ref.invalidate(ownProviderServicesProvider);
      ref
          .read(serviceChangesListProvider(_filter).notifier)
          .load(refresh: true);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final offerings = ref.watch(ownProviderServicesProvider);
    final requests = ref.watch(serviceChangesListProvider(_filter));
    final changes = ref.read(serviceChangesListProvider(_filter).notifier);
    return DefaultTabController(
      length: 2,
      initialIndex: widget.initialTab,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Dịch vụ của tôi'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Đang cung cấp'),
              Tab(text: 'Đề xuất thay đổi'),
            ],
          ),
        ),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => context.push('/provider/service-changes/new'),
          icon: const Icon(Icons.add),
          label: const Text('Thêm / đề xuất'),
        ),
        body: TabBarView(
          children: [
            RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(ownProviderServicesProvider);
                await ref.read(ownProviderServicesProvider.future);
              },
              child: offerings.when(
                skipLoadingOnRefresh: true,
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => ListView(
                  children: [
                    ServiceAsyncMessage(
                      message: serviceError(error),
                      retry: () => ref.invalidate(ownProviderServicesProvider),
                    ),
                  ],
                ),
                data: (items) => ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                  itemCount: items.isEmpty ? 1 : items.length,
                  itemBuilder: (context, index) => items.isEmpty
                      ? const ServiceAsyncMessage(
                          message: 'Bạn chưa có dịch vụ được duyệt. Hãy tạo đề xuất để bắt đầu.',
                        )
                      : ProviderOfferingTile(
                          offering: items[index],
                          onTap: () => context.push(
                            '/provider/services/${items[index].id}',
                          ),
                        ),
                ),
              ),
            ),
            Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: DropdownButtonFormField<ServiceChangeStatus>(
                    key: ValueKey(_filter),
                    initialValue: _filter,
                    isExpanded: true,
                    decoration: const InputDecoration(
                      labelText: 'Trạng thái đề xuất',
                    ),
                    items: [
                      const DropdownMenuItem(
                        value: null,
                        child: Text('Tất cả'),
                      ),
                      for (final status in ServiceChangeStatus.values)
                        DropdownMenuItem(
                          value: status,
                          child: Text(status.label),
                        ),
                    ],
                    onChanged: (value) => setState(() => _filter = value),
                  ),
                ),
                SizedBox(
                  height: 3,
                  child: requests.loading
                      ? const LinearProgressIndicator()
                      : null,
                ),
                if (requests.error != null)
                  ServiceAsyncMessage(
                    message: requests.error!,
                    retry: requests.loading
                        ? null
                        : () => changes.load(refresh: !requests.loaded),
                  ),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: () => changes.load(refresh: true),
                    child: ListView.builder(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 100),
                      itemCount: requests.items.length + 1,
                      itemBuilder: (context, index) {
                        if (index < requests.items.length) {
                          final item = requests.items[index];
                          return ServiceRequestTile(
                            request: item,
                            onTap: () => context.push(
                              '/provider/service-changes/${item.id}',
                            ),
                          );
                        }
                        if (requests.hasMore) {
                          return TextButton(
                            onPressed: requests.loading
                                ? null
                                : () => changes.load(),
                            child: const Text('Tải thêm đề xuất'),
                          );
                        }
                        return requests.items.isEmpty &&
                                !requests.loading &&
                                requests.error == null
                            ? const ServiceAsyncMessage(
                                message: 'Chưa có đề xuất ở trạng thái này.',
                              )
                            : const SizedBox.shrink();
                      },
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

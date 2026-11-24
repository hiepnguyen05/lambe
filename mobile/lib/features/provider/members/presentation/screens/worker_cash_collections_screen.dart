import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile/core/theme/app_colors.dart';
import '../providers/worker_collections_notifier.dart';
import '../providers/worker_workspace_notifier.dart';

class WorkerCashCollectionsScreen extends ConsumerWidget {
  const WorkerCashCollectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspace = ref.watch(workerWorkspaceProvider);
    final membership = workspace.activeMembership;

    if (membership == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8F9FF),
        appBar: AppBar(
          title: const Text('Thu tiền mặt hộ cơ sở'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.pop(),
          ),
        ),
        body: const Center(
          child: Text('Không tìm thấy thông tin thành viên.'),
        ),
      );
    }

    final state = ref.watch(workerCollectionsProvider(membership.id));
    final currencyFormatter =
        NumberFormat.currency(locale: 'vi_VN', symbol: 'đ', decimalDigits: 0);
    final dtFormat = DateFormat('dd/MM/yyyy HH:mm');

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Thu tiền mặt hộ cơ sở',
          style: TextStyle(
            color: Color(0xFF0B1C30),
            fontWeight: FontWeight.bold,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF0B1C30)),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF0B1C30)),
            onPressed: () => ref
                .read(workerCollectionsProvider(membership.id).notifier)
                .loadCollections(),
          ),
        ],
      ),
      body: state.isLoading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            )
          : RefreshIndicator(
              onRefresh: () => ref
                  .read(workerCollectionsProvider(membership.id).notifier)
                  .loadCollections(),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Notice Card
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEFF6FF),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFBFDBFE)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Icon(Icons.shield_outlined,
                            color: Color(0xFF2563EB), size: 22),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Toàn bộ tiền mặt thu trực tiếp từ khách hàng là khoản thu hộ cơ sở. Vui lòng bàn giao và đối soát đầy đủ cho chủ tổ chức.',
                            style: TextStyle(
                              fontSize: 13,
                              color: Color(0xFF1E40AF),
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Summary Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0F766E), Color(0xFF0D9488)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F766E).withValues(alpha: 0.3),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Tổng tiền mặt đã thu hộ',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          currencyFormatter.format(
                            state.summary?.cashRecordedAmount ?? 0,
                          ),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Divider(color: Colors.white24, height: 1),
                        const SizedBox(height: 14),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Số đơn hoàn tất thu tiền: ${state.summary?.cashRecordedOrderCount ?? 0}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                              ),
                            ),
                            Text(
                              'Đơn chưa khớp: ${state.summary?.cashUnverifiedOrderCount ?? 0}',
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Orders section title
                  const Text(
                    'Lịch sử các đơn thu tiền mặt',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                  const SizedBox(height: 12),

                  if (state.orders.isEmpty)
                    const Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: Text(
                          'Chưa có đơn hàng thu tiền mặt nào.',
                          style: TextStyle(color: Color(0xFF6B7280)),
                        ),
                      ),
                    )
                  else
                    ...state.orders.map(
                      (order) => Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Đơn #${order.orderCode}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                    color: Color(0xFF0B1C30),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                if (order.completedAt != null)
                                  Text(
                                    dtFormat.format(order.completedAt!.toLocal()),
                                    style: const TextStyle(
                                      fontSize: 12,
                                      color: Color(0xFF6B7280),
                                    ),
                                  ),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  currencyFormatter.format(
                                    order.cashCollectedAmount ??
                                        order.customerPayableAmount,
                                  ),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                    color: Color(0xFF0F766E),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: order.cashCollectionStatus ==
                                            'RECORDED'
                                        ? const Color(0xFFD1FAE5)
                                        : const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    order.cashCollectionStatus == 'RECORDED'
                                        ? 'Đã ghi nhận'
                                        : 'Chờ đối soát',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      color: order.cashCollectionStatus ==
                                              'RECORDED'
                                          ? const Color(0xFF065F46)
                                          : const Color(0xFF92400E),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}


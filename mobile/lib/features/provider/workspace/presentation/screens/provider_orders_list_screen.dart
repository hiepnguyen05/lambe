import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../di/provider_workspace_providers.dart';

import 'package:mobile/core/widgets/order_status_badge.dart';

class ProviderOrdersListScreen extends ConsumerStatefulWidget {
  const ProviderOrdersListScreen({super.key});

  @override
  ConsumerState<ProviderOrdersListScreen> createState() =>
      _ProviderOrdersListScreenState();
}

class _ProviderOrdersListScreenState
    extends ConsumerState<ProviderOrdersListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(providerOrdersListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        title: const Text(
          'Đơn đặt lịch của bạn',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0B1C30),
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        bottom: TabBar(
          isScrollable: true,
          controller: _tabController,
          labelColor: const Color(0xFF0F766E),
          unselectedLabelColor: const Color(0xFF64748B),
          indicatorColor: const Color(0xFF0F766E),
          indicatorWeight: 3,
          labelStyle: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
          tabs: const [
            Tab(text: 'Yêu cầu mới'),
            Tab(text: 'Đang làm'),
            Tab(text: 'Hoàn tất'),
            Tab(text: 'Cần hỗ trợ'),
          ],
        ),
      ),
      body: ordersAsync.when(
        skipLoadingOnRefresh: true,
        skipLoadingOnReload: false,
        loading: () => const Center(
          child: CircularProgressIndicator(color: Color(0xFF0F766E)),
        ),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.wifi_off_rounded,
                  size: 48,
                  color: Color(0xFF94A3B8),
                ),
                const SizedBox(height: 12),
                Text(
                  err.toString().replaceFirst('Exception: ', ''),
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () => ref.invalidate(providerOrdersListProvider),
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Tải lại'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                  ),
                ),
              ],
            ),
          ),
        ),
        data: (orders) {
          final pendingOrders = orders
              .where((o) => o['status'] == 'PENDING_PROVIDER')
              .toList();
          final activeOrders = orders.where((o) {
            final s = o['status']?.toString();
            return s == 'ACCEPTED' ||
                s == 'EN_ROUTE' ||
                s == 'ARRIVED' ||
                s == 'IN_PROGRESS';
          }).toList();
          final finishedOrders = orders.where((o) {
            final s = o['status']?.toString();
            return s == 'COMPLETED' ||
                s == 'CANCELLED' ||
                s == 'REJECTED' ||
                s == 'EXPIRED';
          }).toList();

          return TabBarView(
            controller: _tabController,
            children: [
              _buildOrdersList(
                pendingOrders,
                emptyLabel: 'Không có yêu cầu đặt lịch mới nào',
              ),
              _buildOrdersList(
                activeOrders,
                emptyLabel: 'Không có đơn nào đang trong tiến trình làm',
              ),
              _buildOrdersList(
                finishedOrders,
                emptyLabel: 'Chưa có lịch sử đơn hoàn thành nào',
              ),
              _buildOrdersList(
                orders
                    .where(
                      (order) => const {
                        'PAYMENT_DISPUTE',
                        'DISPUTED',
                        'SAFETY_HOLD',
                      }.contains(order['status']),
                    )
                    .toList(),
                emptyLabel: 'Không có đơn hàng cần hỗ trợ',
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildOrdersList(
    List<Map<String, dynamic>> orders, {
    required String emptyLabel,
  }) {
    if (orders.isEmpty) {
      return RefreshIndicator(
        color: const Color(0xFF0F766E),
        onRefresh: () => ref.refresh(providerOrdersListProvider.future),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(32),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.15),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.calendar_today_rounded,
                    size: 44,
                    color: Color(0xFF94A3B8),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    emptyLabel,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF64748B),
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final currencyFormatter = NumberFormat.currency(
      locale: 'vi_VN',
      symbol: 'đ',
      decimalDigits: 0,
    );

    return RefreshIndicator(
      color: const Color(0xFF0F766E),
      onRefresh: () => ref.refresh(providerOrdersListProvider.future),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final order = orders[index];
          final id = order['id']?.toString() ?? '';
          final status = order['status']?.toString() ?? '';
          final serviceName = order['serviceName']?.toString() ?? 'Dịch vụ';
          final totalAmount = (order['totalAmount'] as num?)?.toInt() ?? 0;
          final isAsap = order['bookingType'] == 'ASAP';
          final scheduledAtStr = order['scheduledAt']?.toString();
          final scheduledDate = scheduledAtStr != null
              ? DateTime.tryParse(scheduledAtStr)?.toLocal()
              : null;
          final timeStr = isAsap
              ? '⚡ Đặt ngay (ASAP)'
              : (scheduledDate != null
                    ? '📅 ${DateFormat('HH:mm - dd/MM/yyyy').format(scheduledDate)}'
                    : 'Lịch hẹn');

          return Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              onTap: () {
                context.push('/provider/orders/$id');
              },
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
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
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            timeStr,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: isAsap
                                  ? const Color(0xFFD97706)
                                  : const Color(0xFF0F766E),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        OrderStatusBadge(status: status),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      serviceName,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      order['addressLine'] != null
                          ? 'Địa chỉ: ${order['addressLine']}'
                          : 'Khu vực: ${order['addressLabel'] ?? 'Chỉ hiển thị sau khi nhận đơn'}',
                      style: TextStyle(
                        fontSize: 12,
                        color: order['addressLine'] != null
                            ? const Color(0xFF475569)
                            : const Color(0xFF94A3B8),
                        fontStyle: order['addressLine'] == null
                            ? FontStyle.italic
                            : FontStyle.normal,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 10),
                    const Divider(height: 1, color: Color(0xFFF1F5F9)),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Expanded(
                          child: Text(
                            'Tiền thu khách (tiền mặt)',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF64748B),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          currencyFormatter.format(totalAmount),
                          style: const TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF0F766E),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

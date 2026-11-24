import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:mobile/core/widgets/app_dialog.dart';

import '../providers/customer_orders_providers.dart';
import '../widgets/appointments/customer_appointment_card.dart';
import '../../domain/entities/customer_order_entity.dart';
import '../widgets/review/order_review_bottom_sheet.dart';

class CustomerAppointmentsScreen extends ConsumerStatefulWidget {
  const CustomerAppointmentsScreen({super.key});

  @override
  ConsumerState<CustomerAppointmentsScreen> createState() =>
      _CustomerAppointmentsScreenState();
}

class _CustomerAppointmentsScreenState
    extends ConsumerState<CustomerAppointmentsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _openReviewSheet(CustomerOrderEntity order) {
    OrderReviewBottomSheet.show(
      context,
      providerName: order.provider?.displayName ?? 'Chuyên viên',
      serviceName: order.serviceName,
      onConfirm: (rating, comment) async {
        final success = await ref
            .read(customerOrderDetailNotifierProvider(order.id).notifier)
            .submitReview(rating: rating, comment: comment);
        if (mounted && success) {
          AppDialog.success(
            context,
            message: 'Cảm ơn bạn đã gửi đánh giá dịch vụ!',
          );
          ref.invalidate(customerOrdersListProvider);
        }
        return success;
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(customerOrdersListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Lịch sử đơn hàng',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF0F172A),
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: Color(0xFF0F766E)),
            tooltip: 'Làm mới',
            onPressed: () => ref.invalidate(customerOrdersListProvider),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(104),
          child: Column(
            children: [
              // Thanh tìm kiếm nhanh
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 6,
                ),
                child: Container(
                  height: 38,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(19),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.search_rounded,
                        size: 18,
                        color: Color(0xFF94A3B8),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          onChanged: (val) {
                            setState(() {
                              _searchQuery = val.trim().toLowerCase();
                            });
                          },
                          style: const TextStyle(
                            fontSize: 13,
                            color: Color(0xFF0F172A),
                          ),
                          decoration: const InputDecoration(
                            isDense: true,
                            hintText: 'Tìm theo dịch vụ, thợ hoặc mã đơn...',
                            hintStyle: TextStyle(
                              fontSize: 12.5,
                              color: Color(0xFF94A3B8),
                            ),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                            errorBorder: InputBorder.none,
                            disabledBorder: InputBorder.none,
                            focusedErrorBorder: InputBorder.none,
                            filled: false,
                            contentPadding: EdgeInsets.symmetric(vertical: 8),
                          ),
                        ),
                      ),
                      if (_searchQuery.isNotEmpty)
                        GestureDetector(
                          onTap: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                          child: const Icon(
                            Icons.close_rounded,
                            size: 16,
                            color: Color(0xFF64748B),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // 4 Tab phân loại trạng thái
              TabBar(
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
                  Tab(text: 'Tất cả'),
                  Tab(text: 'Đang diễn ra'),
                  Tab(text: 'Hoàn tất'),
                  Tab(text: 'Đã hủy'),
                  Tab(text: 'Cần hỗ trợ'),
                ],
              ),
            ],
          ),
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
                  onPressed: () => ref.invalidate(customerOrdersListProvider),
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
        data: (allOrders) {
          // Lọc theo search query
          final filtered = allOrders.where((o) {
            if (_searchQuery.isEmpty) return true;
            final matchService = o.serviceName.toLowerCase().contains(
              _searchQuery,
            );
            final matchProvider =
                o.provider?.displayName.toLowerCase().contains(_searchQuery) ??
                false;
            final matchId = o.id.toLowerCase().contains(_searchQuery);
            return matchService || matchProvider || matchId;
          }).toList();

          final activeOrders = filtered.where((o) => o.isActive).toList();
          final completedOrders = filtered.where((o) => o.isCompleted).toList();
          final cancelledOrders = filtered
              .where((o) => o.isCancelled || o.isRejected || o.isExpired)
              .toList();

          return TabBarView(
            controller: _tabController,
            children: [
              _buildOrdersList(filtered, emptyMessage: 'Chưa có đơn hàng nào'),
              _buildOrdersList(
                activeOrders,
                emptyMessage: 'Không có đơn hàng nào đang diễn ra',
              ),
              _buildOrdersList(
                completedOrders,
                emptyMessage: 'Chưa có đơn hàng nào hoàn tất',
              ),
              _buildOrdersList(
                cancelledOrders,
                emptyMessage: 'Không có đơn hàng nào bị hủy',
              ),
              _buildOrdersList(
                filtered.where((order) => order.needsSupport).toList(),
                emptyMessage: 'Không có đơn hàng cần hỗ trợ',
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildOrdersList(
    List<CustomerOrderEntity> orders, {
    required String emptyMessage,
  }) {
    if (orders.isEmpty) {
      return RefreshIndicator(
        color: const Color(0xFF0F766E),
        onRefresh: () => ref.refresh(customerOrdersListProvider.future),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(32),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.15),
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  color: Color(0xFFEFF6F5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  size: 38,
                  color: Color(0xFF0F766E),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              emptyMessage,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F172A),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            const Text(
              'Khám phá hàng trăm dịch vụ làm đẹp tại nhà chất lượng cao ngay hôm nay!',
              style: TextStyle(fontSize: 12.5, color: Color(0xFF64748B)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 18),
            Center(
              child: ElevatedButton.icon(
                onPressed: () => context.go('/explore'),
                icon: const Icon(Icons.explore_outlined, size: 18),
                label: const Text('Khám phá dịch vụ'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 11,
                  ),
                ),
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
      onRefresh: () => ref.refresh(customerOrdersListProvider.future),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 14),
        itemBuilder: (context, index) {
          final order = orders[index];
          return CustomerAppointmentCard(
            order: order,
            currencyFormatter: currencyFormatter,
            onOpenReview: _openReviewSheet,
          );
        },
      ),
    );
  }
}

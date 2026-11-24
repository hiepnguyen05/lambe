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
            fontWeight: FontWeight.w800,
            color: Color(0xFF0F172A),
            letterSpacing: -0.3,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        actions: [
          IconButton(
            icon: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDFA),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(
                Icons.refresh_rounded,
                color: Color(0xFF0F766E),
                size: 20,
              ),
            ),
            tooltip: 'Làm mới danh sách',
            onPressed: () => ref.invalidate(customerOrdersListProvider),
          ),
          const SizedBox(width: 8),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(114),
          child: Column(
            children: [
              // Thanh tìm kiếm
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 6,
                ),
                child: Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.search_rounded,
                        size: 20,
                        color: Color(0xFF0F766E),
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
                            fontSize: 13.5,
                            color: Color(0xFF0F172A),
                          ),
                          decoration: const InputDecoration(
                            isDense: true,
                            hintText: 'Tìm theo dịch vụ, chuyên viên hoặc mã đơn...',
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
                            contentPadding: EdgeInsets.symmetric(vertical: 10),
                          ),
                        ),
                      ),
                      if (_searchQuery.isNotEmpty)
                        GestureDetector(
                          onTap: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Color(0xFFE2E8F0),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close_rounded,
                              size: 14,
                              color: Color(0xFF64748B),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // 5 Tabs phân loại Capsule / Pill
              ordersAsync.maybeWhen(
                data: (allOrders) => _buildTabBar(allOrders),
                orElse: () => _buildTabBar(const []),
              ),
              const SizedBox(height: 4),
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
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: const BoxDecoration(
                    color: Color(0xFFFEF2F2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.wifi_off_rounded,
                    size: 40,
                    color: Color(0xFFDC2626),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Không thể tải danh sách đơn',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  err.toString().replaceFirst('Exception: ', ''),
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () => ref.invalidate(customerOrdersListProvider),
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Thử lại'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
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

          final activeOrders = filtered
              .where((o) => o.isActive || o.isPending)
              .toList();
          final completedOrders = filtered.where((o) => o.isCompleted).toList();
          final cancelledOrders = filtered
              .where((o) => o.isCancelled || o.isRejected || o.isExpired)
              .toList();
          final supportOrders = filtered
              .where((o) => o.needsSupport || o.isSafetyHold)
              .toList();

          return TabBarView(
            controller: _tabController,
            children: [
              _buildOrdersList(filtered, emptyMessage: 'Chưa có đơn hàng nào'),
              _buildOrdersList(
                activeOrders,
                emptyMessage: 'Không có đơn hàng nào đang diễn ra',
                emptySubtext: 'Khi bạn đặt dịch vụ, tiến trình của chuyên viên sẽ xuất hiện tại đây.',
              ),
              _buildOrdersList(
                completedOrders,
                emptyMessage: 'Chưa có đơn hàng nào hoàn tất',
                emptySubtext: 'Các dịch vụ bạn đã sử dụng thành công sẽ lưu tại đây.',
              ),
              _buildOrdersList(
                cancelledOrders,
                emptyMessage: 'Không có đơn hàng nào bị hủy',
              ),
              _buildOrdersList(
                supportOrders,
                emptyMessage: 'Không có đơn hàng cần hỗ trợ',
                emptySubtext: 'Đơn hàng gặp sự cố an toàn hoặc khiếu nại sẽ hiển thị tại đây.',
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildTabBar(List<CustomerOrderEntity> allOrders) {
    final activeCount = allOrders.where((o) => o.isActive || o.isPending).length;
    final completedCount = allOrders.where((o) => o.isCompleted).length;
    final cancelledCount = allOrders.where((o) => o.isCancelled || o.isRejected || o.isExpired).length;
    final supportCount = allOrders.where((o) => o.needsSupport || o.isSafetyHold).length;

    return TabBar(
      isScrollable: true,
      tabAlignment: TabAlignment.start,
      controller: _tabController,
      dividerColor: Colors.transparent,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      indicator: BoxDecoration(
        color: const Color(0xFF0F766E),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F766E).withValues(alpha: 0.25),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      indicatorSize: TabBarIndicatorSize.tab,
      labelColor: Colors.white,
      unselectedLabelColor: const Color(0xFF64748B),
      labelStyle: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.bold,
      ),
      unselectedLabelStyle: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
      ),
      tabs: [
        _buildPillTab('Tất cả', allOrders.length),
        _buildPillTab(
          'Đang diễn ra',
          activeCount,
          isHighlight: activeCount > 0,
        ),
        _buildPillTab('Hoàn tất', completedCount),
        _buildPillTab('Đã hủy', cancelledCount),
        _buildPillTab(
          'Cần hỗ trợ',
          supportCount,
          isAlert: supportCount > 0,
        ),
      ],
    );
  }

  Widget _buildPillTab(
    String label,
    int count, {
    bool isHighlight = false,
    bool isAlert = false,
  }) {
    return Tab(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                decoration: BoxDecoration(
                  color: isAlert
                      ? const Color(0xFFFEE2E2)
                      : (isHighlight
                          ? const Color(0xFFCCFBF1)
                          : const Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.bold,
                    color: isAlert
                        ? const Color(0xFFDC2626)
                        : (isHighlight
                            ? const Color(0xFF0F766E)
                            : const Color(0xFF475569)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildOrdersList(
    List<CustomerOrderEntity> orders, {
    required String emptyMessage,
    String emptySubtext = 'Khám phá hàng trăm dịch vụ làm đẹp tại nhà chất lượng cao ngay hôm nay!',
  }) {
    if (orders.isEmpty) {
      return RefreshIndicator(
        color: const Color(0xFF0F766E),
        onRefresh: () => ref.refresh(customerOrdersListProvider.future),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(32),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.12),
            Center(
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDFA),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFCCFBF1), width: 2),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  size: 40,
                  color: Color(0xFF0F766E),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              emptyMessage,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: Color(0xFF0F172A),
                letterSpacing: -0.2,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              emptySubtext,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                height: 1.45,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            Center(
              child: FilledButton.icon(
                onPressed: () => context.go('/explore'),
                icon: const Icon(Icons.auto_awesome, size: 16),
                label: const Text('Khám phá dịch vụ'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0F766E),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(100),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 13,
                  ),
                  elevation: 0,
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
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
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

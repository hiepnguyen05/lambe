import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ordersAsync = ref.watch(providerOrdersListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Đơn đặt lịch của bạn',
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
            onPressed: () => ref.invalidate(providerOrdersListProvider),
          ),
          const SizedBox(width: 8),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(108),
          child: Column(
            children: [
              // Thanh tìm kiếm nhanh
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
                            hintText: 'Tìm theo dịch vụ, khách hàng hoặc mã đơn...',
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

              // 4 Tabs với Underline Indicator dưới chân tab
              ordersAsync.maybeWhen(
                data: (allOrders) => _buildTabBar(allOrders),
                orElse: () => _buildTabBar(const []),
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
                  onPressed: () => ref.invalidate(providerOrdersListProvider),
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
            final matchService = (o['serviceName']?.toString().toLowerCase() ?? '')
                .contains(_searchQuery);
            final matchCustomer = (o['customer']?['fullName']?.toString().toLowerCase() ?? '')
                .contains(_searchQuery);
            final matchContact = (o['contactName']?.toString().toLowerCase() ?? '')
                .contains(_searchQuery);
            final matchId = (o['id']?.toString().toLowerCase() ?? '')
                .contains(_searchQuery);
            return matchService || matchCustomer || matchContact || matchId;
          }).toList();

          final pendingOrders = filtered
              .where((o) => o['status'] == 'PENDING_PROVIDER')
              .toList();

          final activeOrders = filtered.where((o) {
            final s = o['status']?.toString();
            return s == 'ACCEPTED' ||
                s == 'EN_ROUTE' ||
                s == 'ARRIVED' ||
                s == 'IN_PROGRESS';
          }).toList();

          final finishedOrders = filtered.where((o) {
            final s = o['status']?.toString();
            return s == 'COMPLETED' ||
                s == 'CANCELLED' ||
                s == 'REJECTED' ||
                s == 'EXPIRED';
          }).toList();

          final supportOrders = filtered.where((o) {
            final s = o['status']?.toString();
            return s == 'PAYMENT_DISPUTE' ||
                s == 'DISPUTED' ||
                s == 'SAFETY_HOLD';
          }).toList();

          return TabBarView(
            controller: _tabController,
            children: [
              _buildOrdersList(
                pendingOrders,
                emptyLabel: 'Không có yêu cầu đặt lịch mới nào',
                emptySubtext: 'Khi có khách hàng gửi yêu cầu, đơn sẽ xuất hiện tại đây.',
              ),
              _buildOrdersList(
                activeOrders,
                emptyLabel: 'Không có đơn nào đang trong tiến trình làm',
                emptySubtext: 'Các đơn đã nhận và đang di chuyển / làm dịch vụ sẽ hiển thị tại đây.',
              ),
              _buildOrdersList(
                finishedOrders,
                emptyLabel: 'Chưa có lịch sử đơn hoàn thành nào',
                emptySubtext: 'Các đơn bạn đã hoàn thành hoặc kết thúc sẽ lưu lại tại đây.',
              ),
              _buildOrdersList(
                supportOrders,
                emptyLabel: 'Không có đơn hàng cần hỗ trợ',
                emptySubtext: 'Đơn có khiếu nại thanh toán hoặc sự cố an toàn sẽ xuất hiện tại đây.',
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildTabBar(List<Map<String, dynamic>> allOrders) {
    final pendingCount = allOrders.where((o) => o['status'] == 'PENDING_PROVIDER').length;
    final activeCount = allOrders.where((o) {
      final s = o['status']?.toString();
      return s == 'ACCEPTED' || s == 'EN_ROUTE' || s == 'ARRIVED' || s == 'IN_PROGRESS';
    }).length;
    final finishedCount = allOrders.where((o) {
      final s = o['status']?.toString();
      return s == 'COMPLETED' || s == 'CANCELLED' || s == 'REJECTED' || s == 'EXPIRED';
    }).length;
    final supportCount = allOrders.where((o) {
      final s = o['status']?.toString();
      return s == 'PAYMENT_DISPUTE' || s == 'DISPUTED' || s == 'SAFETY_HOLD';
    }).length;

    return TabBar(
      isScrollable: true,
      tabAlignment: TabAlignment.start,
      controller: _tabController,
      dividerColor: const Color(0xFFE2E8F0),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      indicator: const UnderlineTabIndicator(
        borderSide: BorderSide(
          color: Color(0xFF0F766E),
          width: 3.0,
        ),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(3),
          topRight: Radius.circular(3),
        ),
        insets: EdgeInsets.symmetric(horizontal: 2),
      ),
      indicatorSize: TabBarIndicatorSize.label,
      labelColor: const Color(0xFF0F766E),
      unselectedLabelColor: const Color(0xFF64748B),
      labelStyle: const TextStyle(
        fontSize: 13.5,
        fontWeight: FontWeight.bold,
      ),
      unselectedLabelStyle: const TextStyle(
        fontSize: 13.5,
        fontWeight: FontWeight.w500,
      ),
      tabs: [
        _buildTab(
          'Yêu cầu mới',
          pendingCount,
          isHighlight: pendingCount > 0,
        ),
        _buildTab(
          'Đang làm',
          activeCount,
          isHighlight: activeCount > 0,
        ),
        _buildTab('Hoàn tất', finishedCount),
        _buildTab(
          'Cần hỗ trợ',
          supportCount,
          isAlert: supportCount > 0,
        ),
      ],
    );
  }

  Widget _buildTab(
    String label,
    int count, {
    bool isHighlight = false,
    bool isAlert = false,
  }) {
    return Tab(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
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
                          : const Color(0xFFF1F5F9)),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isAlert
                        ? const Color(0xFFDC2626)
                        : (isHighlight
                            ? const Color(0xFF0F766E)
                            : const Color(0xFF64748B)),
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
    List<Map<String, dynamic>> orders, {
    required String emptyLabel,
    String emptySubtext = 'Hãy luôn giữ trạng thái trực tuyến để nhận đơn mới sớm nhất.',
  }) {
    if (orders.isEmpty) {
      return RefreshIndicator(
        color: const Color(0xFF0F766E),
        onRefresh: () => ref.refresh(providerOrdersListProvider.future),
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
                  Icons.assignment_outlined,
                  size: 40,
                  color: Color(0xFF0F766E),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              emptyLabel,
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
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        itemCount: orders.length,
        separatorBuilder: (_, __) => const SizedBox(height: 14),
        itemBuilder: (context, index) {
          final order = orders[index];
          return _buildProviderOrderCard(context, order, currencyFormatter);
        },
      ),
    );
  }

  Widget _buildProviderOrderCard(
    BuildContext context,
    Map<String, dynamic> order,
    NumberFormat currencyFormatter,
  ) {
    final id = order['id']?.toString() ?? '';
    final code = id.length > 8 ? id.substring(0, 8).toUpperCase() : id.toUpperCase();
    final status = order['status']?.toString() ?? '';
    final serviceName = order['serviceName']?.toString() ?? 'Dịch vụ làm đẹp';
    final totalAmount = (order['totalAmount'] as num?)?.toInt() ?? 0;
    final isAsap = order['bookingType'] == 'ASAP';
    final scheduledAtStr = order['scheduledAt']?.toString();
    final scheduledDate = scheduledAtStr != null
        ? DateTime.tryParse(scheduledAtStr)?.toLocal()
        : null;
    final durationMinutes = (order['durationMinutes'] as num?)?.toInt() ?? 60;
    final customerName = order['customer']?['fullName']?.toString() ??
        order['contactName']?.toString() ??
        'Khách hàng';
    final addressLine = order['addressLine']?.toString();
    final addressLabel = order['addressLabel']?.toString();

    final isPending = status == 'PENDING_PROVIDER';
    final isActive = status == 'ACCEPTED' ||
        status == 'EN_ROUTE' ||
        status == 'ARRIVED' ||
        status == 'IN_PROGRESS';
    final isDisputed = status == 'PAYMENT_DISPUTE' ||
        status == 'DISPUTED' ||
        status == 'SAFETY_HOLD';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            context.push('/provider/orders/$id');
          },
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header: Loại đặt & Mã đơn & Trạng thái
                Row(
                  children: [
                    if (isAsap)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF7ED),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFFFEDD5)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.bolt_rounded,
                              size: 14,
                              color: Color(0xFFEA580C),
                            ),
                            SizedBox(width: 3),
                            Text(
                              'Đặt ngay (ASAP)',
                              style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFFC2410C),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDFA),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFFCCFBF1)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.calendar_today_rounded,
                              size: 12,
                              color: Color(0xFF0F766E),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              scheduledDate == null
                                  ? 'Đã hẹn trước'
                                  : DateFormat('HH:mm • dd/MM/yyyy')
                                      .format(scheduledDate),
                              style: const TextStyle(
                                fontSize: 11.5,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F766E),
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(width: 8),

                    // Mã đơn copyable
                    GestureDetector(
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: id));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Đã sao chép mã đơn hàng'),
                            duration: Duration(seconds: 1),
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Text(
                          '#$code',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                    ),

                    const Spacer(),

                    // Badge trạng thái
                    OrderStatusBadge(status: status),
                  ],
                ),
                const SizedBox(height: 14),

                // Dịch vụ & Khách hàng
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6F5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFCCFBF1)),
                      ),
                      child: const Icon(
                        Icons.spa_rounded,
                        color: Color(0xFF0F766E),
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            serviceName,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF0F172A),
                              height: 1.25,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(
                                Icons.person_outline_rounded,
                                size: 14,
                                color: Color(0xFF64748B),
                              ),
                              const SizedBox(width: 4),
                              Flexible(
                                child: Text(
                                  customerName,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF334155),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(5),
                                ),
                                child: Text(
                                  '$durationMinutes phút',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Địa chỉ
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFF1F5F9)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 15,
                        color: Color(0xFF0F766E),
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          addressLine ?? (addressLabel != null
                              ? 'Khu vực: $addressLabel (Địa chỉ cụ thể khi nhận đơn)'
                              : 'Địa chỉ sẽ hiển thị sau khi nhận đơn'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: addressLine != null
                                ? const Color(0xFF475569)
                                : const Color(0xFF94A3B8),
                            fontStyle: addressLine == null
                                ? FontStyle.italic
                                : FontStyle.normal,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                ),

                // Tiền thu & Nút hành động
                Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Tiền thu khách (tiền mặt):',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF64748B),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          currencyFormatter.format(totalAmount),
                          style: const TextStyle(
                            fontSize: 16.5,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0F766E),
                            letterSpacing: -0.2,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    if (isPending)
                      FilledButton.icon(
                        onPressed: () => context.push('/provider/orders/$id'),
                        icon: const Icon(Icons.check_circle_outline_rounded, size: 16),
                        label: const Text('Xem & Nhận đơn'),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF0F766E),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          elevation: 0,
                        ),
                      )
                    else if (isActive)
                      FilledButton.icon(
                        onPressed: () => context.push('/provider/orders/$id'),
                        icon: const Icon(Icons.navigation_rounded, size: 15),
                        label: const Text('Tiến trình đơn'),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF0F766E),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          elevation: 0,
                        ),
                      )
                    else if (isDisputed)
                      OutlinedButton.icon(
                        onPressed: () => context.push('/provider/orders/$id'),
                        icon: const Icon(Icons.warning_amber_rounded, size: 15),
                        label: const Text('Xem sự cố'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFDC2626),
                          side: const BorderSide(color: Color(0xFFFECACA)),
                          backgroundColor: const Color(0xFFFEF2F2),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                        ),
                      )
                    else
                      OutlinedButton(
                        onPressed: () => context.push('/provider/orders/$id'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF475569),
                          side: const BorderSide(color: Color(0xFFE2E8F0)),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                        ),
                        child: const Text('Chi tiết đơn'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

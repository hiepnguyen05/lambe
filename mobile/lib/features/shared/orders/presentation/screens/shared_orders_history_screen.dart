import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/utils/currency_utils.dart';
import 'package:mobile/features/customer/orders/domain/entities/customer_order_entity.dart';
import 'package:mobile/features/customer/orders/presentation/controllers/customer_order_action_coordinator.dart';
import 'package:mobile/features/customer/orders/presentation/providers/customer_orders_providers.dart';
import 'package:mobile/features/provider/workspace/di/provider_workspace_providers.dart';

import '../widgets/shared_order_card.dart';

/// Vai trò hiển thị màn hình lịch sử đơn hàng dùng chung.
enum OrdersHistoryRole { customer, provider }

class _OrderTabSpec {
  final String label;
  final bool Function(String status) matcher;
  final IconData emptyIcon;
  final String emptyLabel;
  final String emptySubtext;
  final bool highlightOnPositive;
  final bool alertOnPositive;

  const _OrderTabSpec({
    required this.label,
    required this.matcher,
    required this.emptyIcon,
    required this.emptyLabel,
    required this.emptySubtext,
    this.highlightOnPositive = false,
    this.alertOnPositive = false,
  });
}

class _OrderEntry {
  final String id;
  final String status;
  final String searchText;
  final SharedOrderCardItem cardItem;

  const _OrderEntry({
    required this.id,
    required this.status,
    required this.searchText,
    required this.cardItem,
  });
}

/// Màn hình Lịch sử / Danh sách đơn hàng dùng chung cho Khách hàng và Chuyên viên.
class SharedOrdersHistoryScreen extends ConsumerStatefulWidget {
  final OrdersHistoryRole role;

  const SharedOrdersHistoryScreen({super.key, required this.role});

  @override
  ConsumerState<SharedOrdersHistoryScreen> createState() =>
      _SharedOrdersHistoryScreenState();
}

class _SharedOrdersHistoryScreenState
    extends ConsumerState<SharedOrdersHistoryScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  static final _currencyFormatter = CurrencyUtils.vndCurrency;

  static bool _isPending(String s) => s == 'PENDING_PROVIDER';
  static bool _isActive(String s) =>
      s == 'ACCEPTED' ||
      s == 'EN_ROUTE' ||
      s == 'ARRIVED' ||
      s == 'IN_PROGRESS';
  static bool _isCompleted(String s) => s == 'COMPLETED';
  static bool _isCancelled(String s) =>
      s == 'CANCELLED' || s == 'REJECTED' || s == 'EXPIRED';
  static bool _isSupport(String s) =>
      s == 'PAYMENT_DISPUTE' || s == 'DISPUTED' || s == 'SAFETY_HOLD';

  late final List<_OrderTabSpec> _tabs = _buildTabsForRole();

  List<_OrderTabSpec> _buildTabsForRole() {
    if (widget.role == OrdersHistoryRole.customer) {
      return [
        _OrderTabSpec(
          label: 'Tất cả',
          matcher: (_) => true,
          emptyIcon: Icons.receipt_long_rounded,
          emptyLabel: 'Chưa có đơn hàng nào',
          emptySubtext:
              'Khám phá hàng trăm dịch vụ làm đẹp tại nhà chất lượng cao ngay hôm nay!',
        ),
        _OrderTabSpec(
          label: 'Đang diễn ra',
          matcher: (s) => _isPending(s) || _isActive(s),
          emptyIcon: Icons.schedule_rounded,
          emptyLabel: 'Không có đơn hàng nào đang diễn ra',
          emptySubtext:
              'Khi bạn đặt dịch vụ, tiến trình của chuyên viên sẽ xuất hiện tại đây.',
          highlightOnPositive: true,
        ),
        _OrderTabSpec(
          label: 'Hoàn tất',
          matcher: _isCompleted,
          emptyIcon: Icons.check_circle_outline_rounded,
          emptyLabel: 'Chưa có đơn hàng nào hoàn tất',
          emptySubtext: 'Các dịch vụ bạn đã sử dụng thành công sẽ lưu tại đây.',
        ),
        _OrderTabSpec(
          label: 'Đã hủy',
          matcher: _isCancelled,
          emptyIcon: Icons.cancel_outlined,
          emptyLabel: 'Không có đơn hàng nào bị hủy',
          emptySubtext: 'Các đơn đã hủy, từ chối hoặc hết hạn sẽ hiển thị tại đây.',
        ),
        _OrderTabSpec(
          label: 'Cần hỗ trợ',
          matcher: _isSupport,
          emptyIcon: Icons.support_agent_rounded,
          emptyLabel: 'Không có đơn hàng cần hỗ trợ',
          emptySubtext:
              'Đơn hàng gặp sự cố an toàn hoặc khiếu nại sẽ hiển thị tại đây.',
          alertOnPositive: true,
        ),
      ];
    }

    return [
      _OrderTabSpec(
        label: 'Tất cả',
        matcher: (_) => true,
        emptyIcon: Icons.assignment_outlined,
        emptyLabel: 'Chưa có đơn đặt lịch nào',
        emptySubtext:
            'Hãy giữ trạng thái trực tuyến để sớm nhận yêu cầu mới từ khách hàng.',
      ),
      _OrderTabSpec(
        label: 'Yêu cầu mới',
        matcher: _isPending,
        emptyIcon: Icons.notifications_none_rounded,
        emptyLabel: 'Không có yêu cầu đặt lịch mới',
        emptySubtext:
            'Khi có khách hàng gửi yêu cầu, đơn sẽ xuất hiện tại đây.',
        highlightOnPositive: true,
      ),
      _OrderTabSpec(
        label: 'Đang làm',
        matcher: _isActive,
        emptyIcon: Icons.work_outline_rounded,
        emptyLabel: 'Không có đơn đang thực hiện',
        emptySubtext:
            'Các đơn đã nhận, đang di chuyển hoặc đang phục vụ sẽ hiển thị tại đây.',
        highlightOnPositive: true,
      ),
      _OrderTabSpec(
        label: 'Hoàn tất',
        matcher: _isCompleted,
        emptyIcon: Icons.check_circle_outline_rounded,
        emptyLabel: 'Chưa có đơn hoàn tất nào',
        emptySubtext:
            'Các đơn dịch vụ bạn đã hoàn thành sẽ được lưu lại tại đây.',
      ),
      _OrderTabSpec(
        label: 'Đã hủy',
        matcher: _isCancelled,
        emptyIcon: Icons.cancel_outlined,
        emptyLabel: 'Không có đơn đã hủy hoặc từ chối',
        emptySubtext:
            'Các đơn đã hủy, từ chối hoặc hết hạn phản hồi sẽ hiển thị tại đây.',
      ),
      _OrderTabSpec(
        label: 'Cần hỗ trợ',
        matcher: _isSupport,
        emptyIcon: Icons.support_agent_rounded,
        emptyLabel: 'Không có đơn cần hỗ trợ',
        emptySubtext:
            'Đơn có tranh chấp thanh toán hoặc sự cố an toàn sẽ xuất hiện tại đây.',
        alertOnPositive: true,
      ),
    ];
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  void _invalidateOrders() {
    if (widget.role == OrdersHistoryRole.customer) {
      ref.invalidate(customerOrdersListProvider);
    } else {
      ref.invalidate(providerOrdersListProvider);
    }
  }

  Future<void> _refreshOrders() {
    if (widget.role == OrdersHistoryRole.customer) {
      return ref.refresh(customerOrdersListProvider.future);
    }
    return ref.refresh(providerOrdersListProvider.future);
  }

  List<_OrderEntry> _mapCustomerOrders(List<CustomerOrderEntity> orders) {
    return orders.map((order) {
      final detailPath = '/appointments/${order.id}';
      final target = order.isActive ? '$detailPath/tracking' : detailPath;
      return _OrderEntry(
        id: order.id,
        status: order.status,
        searchText:
            '${order.serviceName} ${order.provider?.displayName ?? ''} ${order.id}'
                .toLowerCase(),
        cardItem: SharedOrderCardItem(
          id: order.id,
          serviceName: order.serviceName,
          serviceIconUrl: order.serviceIconUrl,
          status: order.status,
          cancellationStatus: order.cancellationRequest?.status,
          totalAmount: order.totalAmount,
          bookingType: order.bookingType,
          scheduledAt: order.scheduledAt,
          locationText: order.addressLine?.trim() ?? '',
          reviewRating: order.review?.rating,
          canReview: order.canReview,
          onTap: () => context.push(target),
          onOpenReview: () => CustomerOrderActionCoordinator.openReviewSheet(
            context: context,
            ref: ref,
            order: order,
          ),
        ),
      );
    }).toList();
  }

  List<_OrderEntry> _mapProviderOrders(List<Map<String, dynamic>> orders) {
    return orders.map((order) {
      final id = order['id']?.toString() ?? '';
      final status = order['status']?.toString() ?? '';
      final serviceName = order['serviceName']?.toString() ?? 'Dịch vụ làm đẹp';
      final customerName =
          (order['customer'] as Map?)?['fullName']?.toString() ?? '';
      final contactName = order['contactName']?.toString() ?? '';
      final addressLine = order['addressLine']?.toString();
      final addressLabel = order['addressLabel']?.toString();
      final locationText = addressLine?.isNotEmpty == true
          ? addressLine!
          : (addressLabel?.isNotEmpty == true
                ? 'Khu vực: $addressLabel'
                : 'Hiển thị địa chỉ sau khi nhận đơn');

      final serviceIconUrl =
          order['serviceIconUrl']?.toString() ??
          ((order['providerService'] as Map?)?['service'] as Map?)?['iconUrl']
              ?.toString() ??
          (((order['providerService'] as Map?)?['service'] as Map?)?['category']
                  as Map?)?['iconUrl']
              ?.toString();

      final scheduledStr = order['scheduledAt']?.toString();
      final scheduledAt = scheduledStr != null
          ? DateTime.tryParse(scheduledStr)?.toLocal()
          : null;
      final reviewMap = order['review'];
      final reviewRating = reviewMap is Map && reviewMap['rating'] is num
          ? (reviewMap['rating'] as num).toInt()
          : null;

      return _OrderEntry(
        id: id,
        status: status,
        searchText: '$serviceName $customerName $contactName $id'.toLowerCase(),
        cardItem: SharedOrderCardItem(
          id: id,
          serviceName: serviceName,
          serviceIconUrl: serviceIconUrl,
          status: status,
          cancellationStatus:
              (order['cancellationRequest'] as Map?)?['status']?.toString(),
          totalAmount: (order['totalAmount'] as num?)?.toInt() ?? 0,
          bookingType: order['bookingType']?.toString() ?? 'ASAP',
          scheduledAt: scheduledAt,
          locationText: locationText,
          reviewRating: reviewRating,
          canReview: false,
          onTap: () => context.push('/provider/orders/$id'),
        ),
      );
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final isCustomer = widget.role == OrdersHistoryRole.customer;
    final entriesAsync = isCustomer
        ? ref.watch(customerOrdersListProvider).whenData(_mapCustomerOrders)
        : ref.watch(providerOrdersListProvider).whenData(_mapProviderOrders);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          isCustomer ? 'Lịch sử đơn hàng' : 'Đơn đặt lịch',
          style: const TextStyle(
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
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(108),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 8,
                ),
                child: Container(
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.search_rounded,
                        size: 19,
                        color: Color(0xFF0F766E),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _searchController,
                          textAlignVertical: TextAlignVertical.center,
                          onChanged: (val) {
                            setState(() {
                              _searchQuery = val.trim().toLowerCase();
                            });
                          },
                          style: const TextStyle(
                            fontSize: 13.5,
                            color: Color(0xFF0F172A),
                          ),
                          decoration: InputDecoration(
                            isDense: true,
                            hintText: isCustomer
                                ? 'Tìm dịch vụ, chuyên viên hoặc mã đơn...'
                                : 'Tìm theo dịch vụ, khách hàng hoặc mã đơn...',
                            hintStyle: const TextStyle(
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
                            contentPadding: EdgeInsets.zero,
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
                            size: 18,
                            color: Color(0xFF64748B),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              entriesAsync.maybeWhen(
                data: _buildTabBar,
                orElse: () => _buildTabBar(const []),
              ),
            ],
          ),
        ),
      ),
      body: entriesAsync.when(
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
                  size: 44,
                  color: Color(0xFFDC2626),
                ),
                const SizedBox(height: 12),
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
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _invalidateOrders,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Thử lại'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                  ),
                ),
              ],
            ),
          ),
        ),
        data: (entries) {
          final filtered = _searchQuery.isEmpty
              ? entries
              : entries
                    .where((e) => e.searchText.contains(_searchQuery))
                    .toList();

          return TabBarView(
            controller: _tabController,
            children: _tabs.map((tab) {
              final tabItems = filtered
                  .where((e) => tab.matcher(e.status))
                  .toList();
              return _buildOrdersList(tabItems, tab);
            }).toList(),
          );
        },
      ),
    );
  }

  Widget _buildTabBar(List<_OrderEntry> allEntries) {
    return TabBar(
      isScrollable: true,
      tabAlignment: TabAlignment.start,
      controller: _tabController,
      dividerColor: const Color(0xFFE2E8F0),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      indicator: const UnderlineTabIndicator(
        borderSide: BorderSide(color: Color(0xFF0F766E), width: 3.0),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(3),
          topRight: Radius.circular(3),
        ),
        insets: EdgeInsets.symmetric(horizontal: 2),
      ),
      indicatorSize: TabBarIndicatorSize.label,
      labelColor: const Color(0xFF0F766E),
      unselectedLabelColor: const Color(0xFF64748B),
      labelStyle: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.bold),
      unselectedLabelStyle: const TextStyle(
        fontSize: 13.5,
        fontWeight: FontWeight.w500,
      ),
      tabs: _tabs.map((tab) {
        final count = allEntries.where((e) => tab.matcher(e.status)).length;
        return _buildTab(
          tab.label,
          count,
          isHighlight: tab.highlightOnPositive && count > 0,
          isAlert: tab.alertOnPositive && count > 0,
        );
      }).toList(),
    );
  }

  Widget _buildTab(
    String label,
    int count, {
    bool isHighlight = false,
    bool isAlert = false,
  }) {
    return Tab(
      height: 44,
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
    );
  }

  Widget _buildOrdersList(List<_OrderEntry> entries, _OrderTabSpec tab) {
    if (entries.isEmpty) {
      return RefreshIndicator(
        color: const Color(0xFF0F766E),
        onRefresh: _refreshOrders,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(32),
          children: [
            SizedBox(height: MediaQuery.of(context).size.height * 0.12),
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDFA),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFFCCFBF1), width: 1.5),
                ),
                child: Icon(
                  tab.emptyIcon,
                  size: 34,
                  color: const Color(0xFF0F766E),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              tab.emptyLabel,
              style: const TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF0F172A),
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            Text(
              tab.emptySubtext,
              style: const TextStyle(
                fontSize: 13,
                color: Color(0xFF64748B),
                height: 1.45,
              ),
              textAlign: TextAlign.center,
            ),
            if (widget.role == OrdersHistoryRole.customer) ...[
              const SizedBox(height: 20),
              Center(
                child: FilledButton.icon(
                  onPressed: () => context.go('/explore'),
                  icon: const Icon(Icons.auto_awesome_rounded, size: 16),
                  label: const Text('Khám phá dịch vụ'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF0F766E),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 22,
                      vertical: 12,
                    ),
                    elevation: 0,
                  ),
                ),
              ),
            ],
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: const Color(0xFF0F766E),
      onRefresh: _refreshOrders,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        itemCount: entries.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) => SharedOrderCard(
          item: entries[index].cardItem,
          currencyFormatter: _currencyFormatter,
        ),
      ),
    );
  }
}

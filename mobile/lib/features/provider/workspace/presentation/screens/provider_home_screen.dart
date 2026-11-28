import 'package:flutter/material.dart';
import 'package:mobile/features/shared/guidance/presentation/guidance_trigger.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/features/provider/members/presentation/providers/worker_workspace_notifier.dart';
import 'package:mobile/features/provider/members/presentation/widgets/worker_workspace_view.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';

import '../../di/provider_workspace_providers.dart';
import '../../application/provider_upcoming_appointments_provider.dart';
import '../../domain/entities/incoming_order_entity.dart';
import '../widgets/incoming_order/incoming_order_modal.dart';
import '../widgets/online_status_card.dart';
import '../widgets/organization_workspace_view.dart';
import '../widgets/provider_home_app_bar.dart';
import '../widgets/service_radius_card.dart';
import '../widgets/today_earnings_card.dart';
import '../widgets/upcoming_appointments_section.dart';

class ProviderHomeScreen extends ConsumerStatefulWidget {
  const ProviderHomeScreen({super.key});

  @override
  ConsumerState<ProviderHomeScreen> createState() => _ProviderHomeScreenState();
}

class _ProviderHomeScreenState extends ConsumerState<ProviderHomeScreen> {
  bool _isModalShowing = false;

  void _listenForIncomingOrders() {
    ref.listen<IncomingOrderEntity?>(providerIncomingOrdersProvider, (
      prev,
      next,
    ) {
      if (next != null && !_isModalShowing && mounted) {
        _isModalShowing = true;
        IncomingOrderModal.show(
          context,
          order: next,
          onAccept: () async {
            await ref
                .read(providerIncomingOrdersProvider.notifier)
                .acceptOrder(next.id);
            ref.invalidate(providerDashboardProvider);
          },
          onReject: () {
            return ref
                .read(providerIncomingOrdersProvider.notifier)
                .rejectOrder(next.id);
          },
          onTimeout: () {
            ref
                .read(providerIncomingOrdersProvider.notifier)
                .dismissOrder(next.id);
          },
        ).then((accepted) {
          _isModalShowing = false;
          if (!mounted) return;

          if (accepted == true) {
            context.push('/provider/orders/${next.id}');
          }
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Lắng nghe đơn hàng thật từ Backend
    _listenForIncomingOrders();

    final isOrgEnabled = ref.watch(isOrganizationFeatureEnabledProvider);
    final workerWorkspace = ref.watch(workerWorkspaceProvider);
    final isWorker = isOrgEnabled && workerWorkspace.isWorkerInOrganization;
    final isOrganization = ref.watch(isOrganizationProvider);
    final incoming = ref.watch(providerIncomingOrdersProvider);
    final audienceReady =
        !isOrgEnabled ||
        (!workerWorkspace.isLoading &&
            !ref.watch(partnerProfileNotifierProvider).isLoading);

    if (isWorker) {
      return GuidanceTrigger(
        tourId: 'worker_start',
        enabled: audienceReady && incoming == null && !_isModalShowing,
        child: Scaffold(
          backgroundColor: const Color(0xFFF8F9FF),
          appBar: AppBar(
            backgroundColor: Colors.white,
            elevation: 0,
            title: Text(
              workerWorkspace.activeMembership?.provider?.displayName ??
                  'Không gian Kỹ thuật viên',
              style: const TextStyle(
                color: Color(0xFF0B1C30),
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            centerTitle: false,
            actions: [
              IconButton(
                icon: const Icon(
                  Icons.notifications_none_rounded,
                  color: Color(0xFF0B1C30),
                ),
                onPressed: () => context.push('/notifications'),
              ),
            ],
          ),
          body: RefreshIndicator(
            color: const Color(0xFF0F766E),
            onRefresh: () async {
              await ref.read(workerWorkspaceProvider.notifier).loadWorkspace();
            },
            child: const WorkerWorkspaceView(),
          ),
        ),
      );
    }

    return GuidanceTrigger(
      tourId: isOrganization ? 'organization_start' : 'provider_start',
      enabled: audienceReady && incoming == null && !_isModalShowing,
      child: Scaffold(
        body: RefreshIndicator(
          color: const Color(0xFF0F766E),
          onRefresh: () async {
            await ref
                .read(providerIncomingOrdersProvider.notifier)
                .checkPendingOrders();
            ref.invalidate(providerDashboardProvider);
            ref.invalidate(providerUpcomingAppointmentsProvider);
            ref.invalidate(providerCompletedOrdersProvider);
            ref.invalidate(partnerProfileNotifierProvider);
          },
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              ProviderHomeAppBar(),
              SliverPadding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 20,
                ),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    if (isOrganization) ...[
                      const OrganizationWorkspaceView(),
                    ] else ...[
                      const OnlineStatusCard(),
                      const SizedBox(height: 16),
                      const ServiceRadiusCard(),
                      const SizedBox(height: 16),
                      const TodayEarningsCard(),
                      const SizedBox(height: 16),
                      _buildVoucherPromotionCard(context),
                      const SizedBox(height: 24),
                    ],
                    const UpcomingAppointmentsSection(),
                    // Extra padding for bottom nav bar
                    const SizedBox(height: 100),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVoucherPromotionCard(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => context.push('/provider/vouchers'),
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6F5),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.local_offer_rounded,
                    color: Color(0xFF0F766E),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Mã ưu đãi & Voucher của bạn',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Tạo mã giảm giá để thu hút khách đặt lịch',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 14,
                  color: Color(0xFF94A3B8),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

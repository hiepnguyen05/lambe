import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/location/user_location_provider.dart';
import '../../di/provider_workspace_providers.dart';
import '../../domain/entities/incoming_order_entity.dart';
import '../widgets/incoming_order/incoming_order_modal.dart';
import '../widgets/online_status_card.dart';
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final loc = ref.read(userLocationProvider);
      if (!loc.isLoaded) {
        ref.read(userLocationProvider.notifier).fetchLocation();
      }
    });
  }

  void _listenForIncomingOrders() {
    ref.listen<IncomingOrderEntity?>(providerIncomingOrdersProvider, (prev, next) {
      if (next != null && !_isModalShowing && mounted) {
        _isModalShowing = true;
        IncomingOrderModal.show(
          context,
          order: next,
          onAccept: () async {
            await ref.read(providerIncomingOrdersProvider.notifier).acceptOrder(next.id);
            ref.invalidate(providerDashboardProvider);
          },
          onReject: () {
            ref.read(providerIncomingOrdersProvider.notifier).rejectOrder(next.id);
          },
        ).then((accepted) {
          _isModalShowing = false;
          if (!mounted) return;

          if (accepted == true) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  '🎉 Bạn đã nhận đơn thành công! Hãy chuẩn bị đồ nghề và di chuyển tới điểm hẹn.',
                ),
                backgroundColor: Color(0xFF0F766E),
                behavior: SnackBarBehavior.floating,
              ),
            );
          } else if (accepted == false) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Đã từ chối đơn hàng hoặc hết thời gian phản hồi.'),
                backgroundColor: Color(0xFFBA1A1A),
                behavior: SnackBarBehavior.floating,
              ),
            );
          }
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    // Lắng nghe đơn hàng thật từ Backend
    _listenForIncomingOrders();

    return Scaffold(
      body: RefreshIndicator(
        color: const Color(0xFF0F766E),
        onRefresh: () async {
          await ref.read(providerIncomingOrdersProvider.notifier).checkPendingOrders();
          ref.invalidate(providerDashboardProvider);
        },
        child: const CustomScrollView(
          physics: AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            ProviderHomeAppBar(),
            SliverPadding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              sliver: SliverList(
                delegate: SliverChildListDelegate.fixed([
                  OnlineStatusCard(),
                  SizedBox(height: 16),
                  ServiceRadiusCard(),
                  SizedBox(height: 16),
                  TodayEarningsCard(),
                  SizedBox(height: 24),
                  UpcomingAppointmentsSection(),
                  // Extra padding for bottom nav bar
                  SizedBox(height: 100),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

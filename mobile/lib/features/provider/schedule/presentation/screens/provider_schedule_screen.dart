import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/widgets/app_dialog.dart';

import '../../application/provider_schedule_state.dart';
import '../../di/provider_schedule_providers.dart';
import '../widgets/calendar/calendar_timeline_tab.dart';
import '../widgets/time_off/time_off_tab.dart';
import '../widgets/calendar/weekly_shift_tab.dart';

class ProviderScheduleScreen extends ConsumerStatefulWidget {
  const ProviderScheduleScreen({super.key});

  @override
  ConsumerState<ProviderScheduleScreen> createState() =>
      _ProviderScheduleScreenState();
}

class _ProviderScheduleScreenState extends ConsumerState<ProviderScheduleScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<ProviderScheduleState>(providerScheduleNotifierProvider, (
      previous,
      next,
    ) {
      if (next.errorMessage != null &&
          next.errorMessage != previous?.errorMessage) {
        AppDialog.error(context, message: next.errorMessage!);
        ref.read(providerScheduleNotifierProvider.notifier).clearMessage();
      }
    });

    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceContainerLowest,
        elevation: 0,
        centerTitle: false,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Lịch làm & Giờ rảnh',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.bold,
                color: AppColors.onSurface,
              ),
            ),
            const Text(
              'Thiết lập khung giờ nhận việc và lịch nghỉ cá nhân',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.outline,
                fontWeight: FontWeight.normal,
              ),
            ),
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: AppColors.outlineVariant, width: 0.8),
              ),
            ),
            child: TabBar(
              controller: _tabController,
              labelColor: AppColors.primary,
              unselectedLabelColor: AppColors.outline,
              indicatorColor: AppColors.primary,
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
                Tab(
                  icon: Icon(Icons.schedule_rounded, size: 18),
                  text: 'Giờ làm tuần',
                ),
                Tab(
                  icon: Icon(Icons.beach_access_rounded, size: 18),
                  text: 'Báo bận / Nghỉ',
                ),
                Tab(
                  icon: Icon(Icons.calendar_month_rounded, size: 18),
                  text: 'Xem theo ngày',
                ),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          const WeeklyShiftTab(),
          const TimeOffTab(),
          CalendarTimelineTab(
            onNavigateToShifts: () {
              _tabController.animateTo(0);
            },
            onNavigateToTimeOff: () {
              _tabController.animateTo(1);
            },
          ),
        ],
      ),
    );
  }
}

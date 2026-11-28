import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../di/provider_members_providers.dart';
import '../../domain/entities/provider_member_entity.dart';
import '../widgets/invite_worker_bottom_sheet.dart';
import '../widgets/member_card.dart';

class ProviderMembersListScreen extends ConsumerStatefulWidget {
  const ProviderMembersListScreen({super.key});

  @override
  ConsumerState<ProviderMembersListScreen> createState() =>
      _ProviderMembersListScreenState();
}

class _ProviderMembersListScreenState
    extends ConsumerState<ProviderMembersListScreen>
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
    final state = ref.watch(providerMembersNotifierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Đội ngũ nhân sự',
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
            tooltip: 'Lời mời đã gửi',
            icon: const Icon(Icons.outgoing_mail, color: AppColors.primary),
            onPressed: () => context.push('/provider/invitations'),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: const Color(0xFF6B7280),
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          labelStyle: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
          tabs: const [
            Tab(text: 'Tất cả'),
            Tab(text: 'Hoạt động'),
            Tab(text: 'Chờ duyệt'),
            Tab(text: 'Tạm khóa'),
          ],
        ),
      ),
      body: state.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              Text(
                'Lỗi khi tải danh sách: $err',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF6B7280)),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref
                    .read(providerMembersNotifierProvider.notifier)
                    .loadMembers(),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
        data: (members) {
          return TabBarView(
            controller: _tabController,
            children: [
              _buildList(members),
              _buildList(members.where((m) => m.isActive).toList()),
              _buildList(
                members.where((m) => m.isPendingVerification).toList(),
              ),
              _buildList(members.where((m) => m.isSuspended).toList()),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.person_add_rounded),
        label: const Text(
          'Mời thợ mới',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        onPressed: () => InviteWorkerBottomSheet.show(context),
      ),
    );
  }

  Widget _buildList(List<ProviderMemberEntity> list) {
    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surfaceContainer,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.people_outline_rounded,
                size: 48,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Chưa có thành viên nào trong danh mục này',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Color(0xFF4B5563),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Nhấn "Mời thợ mới" để mở rộng đội ngũ của bạn.',
              style: TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () =>
          ref.read(providerMembersNotifierProvider.notifier).loadMembers(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        itemBuilder: (ctx, idx) {
          final member = list[idx];
          return MemberCard(
            member: member,
            onTap: () {
              context.push('/provider/members/${member.id}', extra: member);
            },
          );
        },
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/worker_workspace_notifier.dart';
import 'member_schedule_management_screen.dart';

class WorkerTimeOffScreen extends ConsumerWidget {
  const WorkerTimeOffScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspace = ref.watch(workerWorkspaceProvider);
    final membership = workspace.activeMembership;

    if (membership == null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF8F9FF),
        appBar: AppBar(
          title: const Text('Lịch làm việc của tôi'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.pop(),
          ),
        ),
        body: const Center(
          child: Text('Không tìm thấy thông tin thành viên tổ chức.'),
        ),
      );
    }

    return MemberScheduleManagementScreen(
      memberId: membership.id,
      memberName: 'Cá nhân (${membership.displayName})',
    );
  }
}

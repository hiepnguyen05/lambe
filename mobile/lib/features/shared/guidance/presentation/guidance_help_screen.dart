import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';
import 'package:mobile/features/provider/members/presentation/providers/worker_workspace_notifier.dart';
import 'package:mobile/features/shared/profile/di/partner_profile_providers.dart';
import 'package:mobile/features/provider/workspace/presentation/widgets/provider_setup_checklist.dart';

import '../application/guidance_controller.dart';
import 'guidance_catalog.dart';
import 'guidance_trigger.dart';

class GuidanceHelpScreen extends ConsumerWidget {
  const GuidanceHelpScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final provider = user?.roles.contains('PROVIDER') == true;
    final worker =
        ref.watch(isOrganizationFeatureEnabledProvider) &&
        ref.watch(workerWorkspaceProvider).isWorkerInOrganization;
    final organization = provider && ref.watch(isOrganizationProvider);
    final audience = worker
        ? 'worker'
        : organization
        ? 'organization'
        : 'provider';
    final tours = guidanceTours.values.where(
      (tour) =>
          tour.audience == 'customer' ||
          ((provider || worker) &&
              (tour.audience == audience ||
                  (tour.audience == 'provider' &&
                      tour.id != 'provider_start'))),
    );
    final progress = ref.watch(guidanceProgressProvider).valueOrNull ?? {};
    return Scaffold(
      appBar: AppBar(title: const Text('Hướng dẫn sử dụng')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Padding(
            padding: EdgeInsets.only(bottom: 16),
            child: Text(
              'Xem lại bất kỳ lúc nào. Hướng dẫn minh họa không tạo đơn hoặc thực hiện giao dịch.',
            ),
          ),
          if (provider && !worker && !organization)
            ListTile(
              leading: const Icon(Icons.checklist),
              title: const Text('Kiểm tra thiết lập nhận đơn'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => showModalBottomSheet<void>(
                context: context,
                isScrollControlled: true,
                useSafeArea: true,
                builder: (_) => const SingleChildScrollView(
                  padding: EdgeInsets.all(16),
                  child: ProviderSetupChecklist(),
                ),
              ),
            ),
          for (final tour in tours)
            Card(
              child: ListTile(
                leading: Icon(
                  progress[tour.id]?.status == 'COMPLETED'
                      ? Icons.check_circle_outline
                      : Icons.help_outline,
                ),
                title: Text(tour.title),
                subtitle: Text(
                  tour.audience == 'customer' ? 'Khách hàng' : 'Đối tác',
                ),
                trailing: const Icon(Icons.play_arrow_rounded),
                onTap: () async {
                  await ref.read(guidanceProgressProvider.future);
                  if (context.mounted) {
                    await showGuidance(context, ref, tour.id);
                  }
                },
              ),
            ),
        ],
      ),
    );
  }
}

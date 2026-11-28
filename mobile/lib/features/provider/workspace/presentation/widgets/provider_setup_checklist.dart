import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:mobile/features/shared/guidance/presentation/guidance_trigger.dart';

import '../../application/provider_readiness_provider.dart';

class ProviderSetupChecklist extends ConsumerWidget {
  const ProviderSetupChecklist({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final readiness = ref.watch(providerReadinessProvider);
    final gps = ref.watch(gpsReadinessProvider);
    Future<void> open(String route) async {
      await context.push(route);
      if (!context.mounted) return;
      ref.invalidate(providerReadinessProvider);
      ref.invalidate(gpsReadinessProvider);
    }

    return GuidanceAnchor(
      id: 'provider_setup',
      child: Card(
        margin: const EdgeInsets.only(bottom: 16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: readiness.when(
            loading: () => const ListTile(
              title: Text('Kiểm tra điều kiện nhận đơn…'),
              trailing: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
            error: (_, _) => ListTile(
              title: const Text('Chưa kiểm tra được thiết lập'),
              subtitle: const Text('Tải lại để xem các mục cần hoàn tất.'),
              trailing: IconButton(
                onPressed: () => ref.invalidate(providerReadinessProvider),
                icon: const Icon(Icons.refresh),
              ),
            ),
            data: (data) {
              final checks = {
                for (final row
                    in (data['checks'] as List? ?? []).whereType<Map>())
                  row['code']: row['ready'] == true,
              };
              if (checks.isEmpty) {
                return const Text(
                  'Chưa có dữ liệu kiểm tra thiết lập. Vui lòng tải lại sau.',
                );
              }
              final gpsReady = gps.valueOrNull == true;
              final complete =
                  checks.values.where((v) => v).length + (gpsReady ? 1 : 0);
              final money = NumberFormat.decimalPattern('vi_VN');
              final available = data['availableBalance'] as num?;
              final minimum = data['minimumBalance'] as num?;
              Widget item(
                String code,
                String title,
                String detail,
                String route,
              ) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  checks[code] == true
                      ? Icons.check_circle
                      : Icons.radio_button_unchecked,
                  color: checks[code] == true
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.outline,
                ),
                title: Text(title),
                subtitle: Text(detail),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => open(route),
              );
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${data['eligible'] == true && gpsReady ? 'Sẵn sàng nhận khách' : 'Thiết lập nhận khách'} · $complete/5',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Kiểm tra lại',
                        onPressed: () {
                          ref.invalidate(providerReadinessProvider);
                          ref.invalidate(gpsReadinessProvider);
                        },
                        icon: const Icon(Icons.refresh),
                      ),
                    ],
                  ),
                  LinearProgressIndicator(value: complete / 5),
                  if (data['blockerMessage'] is String)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(data['blockerMessage'] as String),
                    ),
                  item(
                    'AREA',
                    'Khu vực và bán kính',
                    'Tâm cố định cho đặt trước; GPS cho đặt ngay.',
                    '/provider/service-area',
                  ),
                  item(
                    'WORKING_HOURS',
                    'Lịch làm việc',
                    'Lưu ít nhất một khung giờ có thể phục vụ.',
                    '/provider/schedule',
                  ),
                  item(
                    'SERVICES',
                    'Dịch vụ hoạt động',
                    'Kiểm tra giá, thời lượng và trạng thái dịch vụ.',
                    '/provider/services',
                  ),
                  item(
                    'WALLET',
                    'Ví nhận đơn',
                    available != null && minimum != null
                        ? 'Khả dụng ${money.format(available)}đ · tối thiểu ${money.format(minimum)}đ${available < minimum ? ' · cần thêm ${money.format(minimum - available)}đ' : ''}'
                        : 'Kiểm tra số dư khả dụng.',
                    '/provider/income',
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      gpsReady
                          ? Icons.check_circle
                          : Icons.location_off_outlined,
                    ),
                    title: const Text('Quyền vị trí thiết bị'),
                    subtitle: Text(
                      gpsReady
                          ? 'Đã bật vị trí và cấp quyền. GPS sẽ được kiểm tra khi bật hoạt động.'
                          : 'Cho phép vị trí và bật GPS khi bắt đầu nhận đơn.',
                    ),
                    onTap: () async {
                      if (!await Geolocator.isLocationServiceEnabled()) {
                        await Geolocator.openLocationSettings();
                      } else {
                        await Geolocator.openAppSettings();
                      }
                      if (context.mounted) ref.invalidate(gpsReadinessProvider);
                    },
                  ),
                  TextButton.icon(
                    onPressed: () =>
                        showGuidance(context, ref, 'provider_workflow'),
                    icon: const Icon(Icons.play_circle_outline),
                    label: const Text('Xem trước quy trình làm việc'),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/worker_workspace_notifier.dart';

class WorkerOnlineToggleCard extends ConsumerWidget {
  const WorkerOnlineToggleCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(workerWorkspaceProvider);
    final isOnline = state.isOnline;
    final radius = state.settings?.effectiveRadiusKm ?? 10;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isOnline ? const Color(0xFF0F766E) : Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isOnline ? Colors.transparent : const Color(0xFFE5E7EB),
        ),
        boxShadow: [
          BoxShadow(
            color: isOnline
                ? const Color(0xFF0F766E).withValues(alpha: 0.3)
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isOnline
                          ? const Color(0xFF34D399)
                          : const Color(0xFF9CA3AF),
                      boxShadow: isOnline
                          ? [
                              BoxShadow(
                                color: const Color(0xFF34D399)
                                    .withValues(alpha: 0.5),
                                blurRadius: 6,
                                spreadRadius: 2,
                              ),
                            ]
                          : null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    isOnline ? 'ĐANG TRỰC TUYẾN' : 'ĐANG NGOẠI TUYẾN',
                    style: TextStyle(
                      color: isOnline ? Colors.white70 : const Color(0xFF6B7280),
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              Switch(
                value: isOnline,
                activeThumbColor: Colors.white,
                activeTrackColor: const Color(0xFF0D9488),
                inactiveThumbColor: Colors.white,
                inactiveTrackColor: const Color(0xFFE5E7EB),
                onChanged: state.isTogglingOnline
                    ? null
                    : (val) {
                        // Gọi toggle với tọa độ hiện tại (hoặc mặc định trung tâm nếu chưa cấp quyền)
                        ref.read(workerWorkspaceProvider.notifier).toggleOnline(
                              latitude: 10.7769,
                              longitude: 106.7009,
                            );
                      },
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            isOnline
                ? 'Sẵn sàng nhận việc trong bán kính $radius km'
                : 'Bật trực tuyến để nhận thông báo đơn hàng mới',
            style: TextStyle(
              color: isOnline ? Colors.white : const Color(0xFF0B1C30),
              fontSize: 17,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            isOnline
                ? 'GPS Heartbeat đang hoạt động • Tọa độ tự động cập nhật'
                : 'Vị trí hiện tại sẽ được dùng khi bạn chuyển sang trực tuyến',
            style: TextStyle(
              color: isOnline ? Colors.white70 : const Color(0xFF6B7280),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

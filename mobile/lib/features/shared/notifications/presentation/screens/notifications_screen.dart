import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../providers/notifications_providers.dart';
import '../widgets/notification_card.dart';
import '../widgets/notification_category_chip.dart';
import '../widgets/notifications_empty_state.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authNotifierProvider);
    final userId = auth.valueOrNull?.id;
    final selectedCategory = ref.watch(selectedNotificationCategoryProvider);

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: true,
        title: const Text(
          'Thông báo',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: 17,
            color: Color(0xFF0B1C30),
          ),
        ),
      ),
      body: userId == null
          ? const Center(
              child: Text(
                'Vui lòng đăng nhập để xem thông báo.',
                style: TextStyle(fontSize: 15, color: Colors.grey),
              ),
            )
          : Column(
              children: [
                // Thanh danh mục bộ lọc ngang (Tất cả, Đơn hàng, Khuyến mãi, Hệ thống)
                Container(
                  color: Colors.white,
                  child: const NotificationCategoryBar(),
                ),
                const Divider(height: 1, thickness: 0.8),

                // Danh sách thông báo
                Expanded(
                  child: ref
                      .watch(notificationsNotifierProvider(userId))
                      .when(
                        loading: () =>
                            const Center(child: CircularProgressIndicator()),
                        error: (error, _) => Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.error_outline_rounded,
                                size: 40,
                                color: Colors.grey,
                              ),
                              const SizedBox(height: 12),
                              const Text(
                                'Không tải được danh sách thông báo.',
                                style: TextStyle(color: Colors.grey),
                              ),
                              const SizedBox(height: 12),
                              ElevatedButton(
                                onPressed: () {
                                  ref
                                      .read(
                                        notificationsNotifierProvider(userId)
                                            .notifier,
                                      )
                                      .load();
                                },
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                ),
                                child: const Text('Thử lại'),
                              ),
                            ],
                          ),
                        ),
                        data: (_) {
                          final filteredList = ref.watch(
                            filteredNotificationsProvider,
                          );

                          if (filteredList.isEmpty) {
                            return RefreshIndicator(
                              onRefresh: () => ref
                                  .read(
                                    notificationsNotifierProvider(userId)
                                        .notifier,
                                  )
                                  .load(),
                              child: ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                children: [
                                  NotificationsEmptyState(
                                    category: selectedCategory,
                                  ),
                                ],
                              ),
                            );
                          }

                          return RefreshIndicator(
                            onRefresh: () => ref
                                .read(
                                  notificationsNotifierProvider(userId)
                                      .notifier,
                                )
                                .refresh(),
                            color: AppColors.primary,
                            child: ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              itemCount: filteredList.length,
                              separatorBuilder: (_, __) => Divider(
                                height: 1,
                                thickness: 0.6,
                                color: Colors.grey.shade200,
                              ),
                              itemBuilder: (context, index) {
                                final item = filteredList[index];
                                return NotificationCard(
                                  notification: item,
                                  userId: userId,
                                );
                              },
                            ),
                          );
                        },
                      ),
                ),
              ],
            ),
    );
  }
}

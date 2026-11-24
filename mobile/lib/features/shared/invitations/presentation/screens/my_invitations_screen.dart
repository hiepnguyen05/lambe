import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/theme/app_colors.dart';

import '../../di/invitations_providers.dart';
import '../widgets/invitation_card.dart';

class MyInvitationsScreen extends ConsumerStatefulWidget {
  const MyInvitationsScreen({super.key});

  @override
  ConsumerState<MyInvitationsScreen> createState() =>
      _MyInvitationsScreenState();
}

class _MyInvitationsScreenState extends ConsumerState<MyInvitationsScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(myInvitationsNotifierProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Lời mời gia nhập',
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
            tooltip: 'Làm mới',
            icon: const Icon(Icons.refresh, color: Color(0xFF0B1C30)),
            onPressed: () => ref
                .read(myInvitationsNotifierProvider.notifier)
                .loadInvitations(),
          ),
        ],
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
                    .read(myInvitationsNotifierProvider.notifier)
                    .loadInvitations(),
                child: const Text('Thử lại'),
              ),
            ],
          ),
        ),
        data: (invitations) {
          if (invitations.isEmpty) {
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
                      Icons.mail_outline_rounded,
                      size: 48,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Không có lời mời nào gửi tới bạn',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF0B1C30),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 40),
                    child: Text(
                      'Khi có cơ sở thẩm mỹ hoặc salon gửi lời mời theo số điện thoại của bạn, thông báo sẽ xuất hiện tại đây.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF6B7280),
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref
                .read(myInvitationsNotifierProvider.notifier)
                .loadInvitations(),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: invitations.length,
              itemBuilder: (ctx, idx) {
                final item = invitations[idx];
                return InvitationCard(
                  invitation: item,
                  onTap: () {
                    context.push('/invitations/${item.id}', extra: item);
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}

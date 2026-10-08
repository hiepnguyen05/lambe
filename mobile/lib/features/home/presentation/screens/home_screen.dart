import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../auth/di/auth_providers.dart';
import '../../../recommendations/presentation/widgets/recommended_services_section.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).value;
    final name = user?.fullName?.trim();

    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FB),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        title: const Text(
          'Lambe',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'Tài khoản',
            onPressed: () => context.push('/profile'),
            icon: const Icon(Icons.account_circle_outlined),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            name == null || name.isEmpty ? 'Xin chào' : 'Xin chào, $name',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: const Color(0xFF0B1C30),
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Bạn muốn chăm sóc bản thân như thế nào hôm nay?',
            style: TextStyle(color: Color(0xFF5F6F6C), height: 1.4),
          ),
          const SizedBox(height: 28),
          const RecommendedServicesSection(),
          const SizedBox(height: 28),
          Text(
            'Tiện ích',
            style: Theme.of(context).textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          _HomeAction(
            icon: Icons.location_on_outlined,
            title: 'Địa chỉ của tôi',
            subtitle: 'Quản lý địa chỉ nhận dịch vụ',
            onTap: () => context.push('/profile/address'),
          ),
          const SizedBox(height: 10),
          _HomeAction(
            icon: Icons.badge_outlined,
            title: 'Trở thành đối tác',
            subtitle: 'Đăng ký cung cấp dịch vụ trên Lambe',
            onTap: () => context.push('/partner/intro'),
          ),
          const SizedBox(height: 10),
          _HomeAction(
            icon: Icons.person_outline,
            title: 'Thông tin cá nhân',
            subtitle: 'Cập nhật hồ sơ và ảnh đại diện',
            onTap: () => context.push('/profile'),
          ),
        ],
      ),
    );
  }
}

class _HomeAction extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _HomeAction({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFE7F6F3),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: const Color(0xFF0F766E)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: Color(0xFF6E7977),
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: Color(0xFF758381)),
            ],
          ),
        ),
      ),
    );
  }
}

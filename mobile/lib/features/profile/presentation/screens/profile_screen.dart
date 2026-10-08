import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/domain/value_objects/upload_payload.dart';
import '../../../../core/utils/app_dialogs.dart';
import '../../../auth/di/auth_providers.dart';
import '../../../recommendations/di/recommendations_providers.dart';
import '../widgets/profile_header.dart';
import '../widgets/profile_menu_group.dart';
import '../widgets/profile_menu_item.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState.value;

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FF),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: ProfileHeader(
              user: user,
              onAvatarTap: () async {
                final ImagePicker picker = ImagePicker();
                final XFile? image = await picker.pickImage(
                  source: ImageSource.gallery,
                );
                if (image != null && context.mounted) {
                  final imageBytes = await image.readAsBytes();
                  if (!context.mounted) return;
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                      ),
                      title: const Text(
                        'Xem trước ảnh',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      content: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.1),
                                  blurRadius: 20,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: ClipOval(
                              child: Image.memory(
                                imageBytes,
                                width: 160,
                                height: 160,
                                fit: BoxFit.cover,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Bạn có muốn sử dụng ảnh này làm ảnh đại diện?',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.black54),
                          ),
                        ],
                      ),
                      actionsAlignment: MainAxisAlignment.center,
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 24,
                              vertical: 12,
                            ),
                          ),
                          child: const Text(
                            'Hủy',
                            style: TextStyle(
                              color: Colors.grey,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        ElevatedButton(
                          onPressed: () async {
                            Navigator.pop(ctx);
                            await ref
                                .read(authNotifierProvider.notifier)
                                .uploadAvatar(
                                  UploadPayload(
                                    bytes: imageBytes,
                                    fileName: image.name,
                                  ),
                                );
                            if (context.mounted) {
                              final error = ref
                                  .read(authNotifierProvider)
                                  .error;
                              if (error == null) {
                                AppDialogs.showMessageDialog(
                                  context,
                                  title: 'Thành công',
                                  message: 'Cập nhật ảnh đại diện thành công!',
                                );
                              } else {
                                AppDialogs.showErrorDialog(
                                  context,
                                  message: error.toString(),
                                );
                              }
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0F766E),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 32,
                              vertical: 12,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(100),
                            ),
                          ),
                          child: const Text(
                            'Lưu ảnh',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  );
                }
              },
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.only(top: 24, bottom: 40),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                ProfileMenuGroup(
                  title: 'Quản lý tài khoản',
                  children: [
                    ProfileMenuItem(
                      icon: Icons.person_outline,
                      title: 'Thông tin cá nhân',
                      subtitle: 'Chỉnh sửa tên, giới tính',
                      onTap: () {
                        context.push('/profile/edit');
                      },
                    ),
                    const Divider(height: 1, indent: 64),
                    ProfileMenuItem(
                      icon: Icons.face_retouching_natural,
                      title: 'Sở thích làm đẹp',
                      subtitle: 'Tùy chỉnh gợi ý dịch vụ',
                      onTap: () async {
                        await context.push('/profile/preferences');
                        ref.invalidate(serviceRecommendationsProvider);
                      },
                    ),
                    const Divider(height: 1, indent: 64),
                    ProfileMenuItem(
                      icon: Icons.location_on_outlined,
                      title: 'Sổ địa chỉ',
                      subtitle: 'Quản lý địa chỉ nhận dịch vụ',
                      onTap: () {
                        context.push('/profile/address');
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                ProfileMenuGroup(
                  title: 'Cài đặt & Tiện ích',
                  children: [
                    ProfileMenuItem(
                      icon: Icons.notifications_none,
                      title: 'Cài đặt thông báo',
                      onTap: () {},
                    ),
                    const Divider(height: 1, indent: 64),
                    ProfileMenuItem(
                      icon: Icons.security,
                      title: 'Bảo mật & Quyền riêng tư',
                      onTap: () {},
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                ProfileMenuGroup(
                  title: 'Hợp tác & Kinh doanh',
                  children: [
                    ProfileMenuItem(
                      icon: Icons.handshake_outlined,
                      title: 'Đăng ký trở thành đối tác',
                      subtitle: 'Dành cho thợ cắt tóc, salon',
                      iconColor: const Color(0xFFD97706), // Orange
                      onTap: () {
                        context.push('/partner/intro');
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                ProfileMenuGroup(
                  title: 'Hỗ trợ',
                  children: [
                    ProfileMenuItem(
                      icon: Icons.headset_mic_outlined,
                      title: 'Trung tâm trợ giúp',
                      onTap: () {},
                    ),
                    const Divider(height: 1, indent: 64),
                    ProfileMenuItem(
                      icon: Icons.description_outlined,
                      title: 'Điều khoản & Chính sách',
                      onTap: () {},
                    ),
                  ],
                ),
                const SizedBox(height: 40),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: InkWell(
                    onTap: () async {
                      final confirm = await AppDialogs.showConfirmDialog(
                        context,
                        title: 'Đăng xuất',
                        message:
                            'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?',
                        confirmText: 'Đăng xuất',
                      );
                      if (confirm == true) {
                        ref.read(authNotifierProvider.notifier).logout();
                        if (context.mounted) {
                          context.go('/auth');
                        }
                      }
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      decoration: BoxDecoration(
                        color: Colors.red.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Text(
                        'Đăng xuất',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.red,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                const Center(
                  child: Text(
                    'Phiên bản 1.0.0',
                    style: TextStyle(color: Color(0xFFBDC9C6), fontSize: 13),
                  ),
                ),
              ]),
            ),
          ),
        ],
      ),
    );
  }
}

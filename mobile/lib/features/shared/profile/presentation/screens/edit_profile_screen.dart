import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:mobile/core/widgets/app_cached_image.dart';
import 'package:mobile/core/widgets/app_dialog.dart';
import 'package:mobile/features/shared/auth/di/auth_providers.dart';

import '../utils/profile_avatar_uploader.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  late TextEditingController _nameController;
  String? _selectedGender;
  bool _seededFromUser = false;
  bool _isSavingProfile = false;

  static const _primary = Color(0xFF0F766E);
  static const _dark = Color(0xFF0B1C30);
  static const _muted = Color(0xFF64748B);

  @override
  void initState() {
    super.initState();
    final user = ref.read(authNotifierProvider).valueOrNull;
    _nameController = TextEditingController(text: user?.fullName ?? '');
    _selectedGender = user?.gender;
    _seededFromUser = user != null;
  }

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (_nameController.text.trim().isEmpty) {
      AppDialog.showErrorDialog(context, message: 'Vui lòng nhập họ và tên');
      return;
    }

    setState(() => _isSavingProfile = true);
    await ref
        .read(authNotifierProvider.notifier)
        .updateProfile(
          fullName: _nameController.text.trim(),
          gender: _selectedGender,
        );
    if (!mounted) return;
    setState(() => _isSavingProfile = false);

    final state = ref.read(authNotifierProvider);
    if (state.hasError) {
      AppDialog.showErrorDialog(context, message: state.error.toString());
    } else {
      AppDialog.showMessageDialog(
        context,
        title: 'Thành công',
        message: 'Cập nhật thông tin cá nhân thành công!',
        onPressed: () => context.pop(),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final user = authState.valueOrNull;

    if (!_seededFromUser && user != null) {
      _seededFromUser = true;
      if (_nameController.text.isEmpty && user.fullName != null) {
        _nameController.text = user.fullName!;
      }
      _selectedGender ??= user.gender;
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Thông tin cá nhân',
          style: TextStyle(
            color: _dark,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        centerTitle: true,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: _dark),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Thẻ ảnh đại diện & tóm tắt tài khoản
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: authState.isLoading
                        ? null
                        : () => pickAndUploadProfileAvatar(context, ref),
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        AppCachedImage.avatar(
                          imageUrl: user?.avatarUrl,
                          size: 60,
                          placeholder: Container(
                            width: 60,
                            height: 60,
                            color: const Color(0xFFEFF6F5),
                            child: const Icon(
                              Icons.person_rounded,
                              color: _primary,
                              size: 30,
                            ),
                          ),
                          errorWidget: Container(
                            width: 60,
                            height: 60,
                            color: const Color(0xFFEFF6F5),
                            child: const Icon(
                              Icons.person_rounded,
                              color: _primary,
                              size: 30,
                            ),
                          ),
                        ),
                        Positioned(
                          right: -2,
                          bottom: -2,
                          child: Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: _primary,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: Colors.white,
                                width: 1.8,
                              ),
                            ),
                            child: const Icon(
                              Icons.camera_alt_rounded,
                              size: 13,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ValueListenableBuilder<TextEditingValue>(
                          valueListenable: _nameController,
                          builder: (_, value, __) {
                            final displayName = value.text.trim().isNotEmpty
                                ? value.text.trim()
                                : 'Chưa cập nhật họ tên';
                            return Text(
                              displayName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: _dark,
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(
                              Icons.phone_outlined,
                              size: 14,
                              color: _muted,
                            ),
                            const SizedBox(width: 4),
                            Flexible(
                              child: Text(
                                user?.phone?.isNotEmpty == true
                                    ? user!.phone!
                                    : 'Chưa liên kết số điện thoại',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: _muted,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        InkWell(
                          onTap: authState.isLoading
                              ? null
                              : () => pickAndUploadProfileAvatar(context, ref),
                          borderRadius: BorderRadius.circular(20),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDFA),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0xFF99F6E4),
                              ),
                            ),
                            child: const Text(
                              'Đổi ảnh đại diện',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: _primary,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // 2. Thẻ biểu mẫu chỉnh sửa
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Thông tin cơ bản',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _dark,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Họ và tên',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: _dark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nameController,
                    textCapitalization: TextCapitalization.words,
                    decoration: InputDecoration(
                      hintText: 'Nhập họ và tên của bạn',
                      hintStyle: const TextStyle(
                        color: Color(0xFF94A3B8),
                        fontSize: 14,
                      ),
                      prefixIcon: const Icon(
                        Icons.badge_outlined,
                        color: _muted,
                        size: 20,
                      ),
                      filled: true,
                      fillColor: const Color(0xFFF8FAFC),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 14,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: _primary,
                          width: 1.8,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'Giới tính',
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: _dark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _GenderChipOption(
                        label: 'Nam',
                        icon: Icons.male_rounded,
                        isSelected: _selectedGender == 'MALE',
                        onTap: () => setState(() => _selectedGender = 'MALE'),
                      ),
                      const SizedBox(width: 8),
                      _GenderChipOption(
                        label: 'Nữ',
                        icon: Icons.female_rounded,
                        isSelected: _selectedGender == 'FEMALE',
                        onTap: () => setState(() => _selectedGender = 'FEMALE'),
                      ),
                      const SizedBox(width: 8),
                      _GenderChipOption(
                        label: 'Khác',
                        icon: Icons.person_outline_rounded,
                        isSelected: _selectedGender == 'OTHER',
                        onTap: () => setState(() => _selectedGender = 'OTHER'),
                      ),
                    ],
                  ),
                  if (user?.phone?.isNotEmpty == true) ...[
                    const SizedBox(height: 18),
                    const Text(
                      'Số điện thoại',
                      style: TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: _dark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 14,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.phone_outlined,
                            size: 19,
                            color: _muted,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              user!.phone!,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF475569),
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.verified_rounded,
                            size: 17,
                            color: _primary,
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE2E8F0))),
          ),
          child: FilledButton(
            onPressed: (_isSavingProfile || authState.isLoading)
                ? null
                : _saveProfile,
            style: FilledButton.styleFrom(
              backgroundColor: _primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(100),
              ),
              elevation: 0,
            ),
            child: (_isSavingProfile || authState.isLoading)
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : const Text(
                    'Lưu thay đổi',
                    style: TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

class _GenderChipOption extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _GenderChipOption({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Material(
        color: isSelected ? const Color(0xFFF0FDFA) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 6),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected
                    ? const Color(0xFF0F766E)
                    : const Color(0xFFE2E8F0),
                width: isSelected ? 1.5 : 1,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  icon,
                  size: 17,
                  color: isSelected
                      ? const Color(0xFF0F766E)
                      : const Color(0xFF64748B),
                ),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: isSelected
                          ? FontWeight.w700
                          : FontWeight.w600,
                      color: isSelected
                          ? const Color(0xFF0F766E)
                          : const Color(0xFF475569),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

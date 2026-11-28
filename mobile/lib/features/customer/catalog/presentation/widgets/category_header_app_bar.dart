import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class CategoryHeaderAppBar extends StatelessWidget {
  final VoidCallback? onBackTap;
  final VoidCallback? onSearchTap;
  final VoidCallback? onShareTap;
  final VoidCallback? onProfileTap;

  const CategoryHeaderAppBar({
    super.key,
    this.onBackTap,
    this.onSearchTap,
    this.onShareTap,
    this.onProfileTap,
  });

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      pinned: true,
      elevation: 0,
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      centerTitle: true,
      leading: IconButton(
        icon: const Icon(
          Icons.arrow_back_ios_new_rounded,
          size: 19,
          color: Color(0xFF0B1C30),
        ),
        onPressed:
            onBackTap ??
            () {
              if (Navigator.of(context).canPop()) {
                context.pop();
              } else {
                context.go('/home');
              }
            },
      ),
      title: const Text(
        'Danh sách dịch vụ',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: Color(0xFF0B1C30),
        ),
      ),
    );
  }
}

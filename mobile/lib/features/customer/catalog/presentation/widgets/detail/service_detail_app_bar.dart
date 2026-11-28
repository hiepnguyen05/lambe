import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ServiceDetailAppBar extends StatelessWidget
    implements PreferredSizeWidget {
  final String title;
  final String? shareTitle;
  final String serviceSlug;
  final String? avatarUrl;
  final VoidCallback? onShare;

  const ServiceDetailAppBar({
    super.key,
    this.title = 'Chi tiết dịch vụ',
    this.shareTitle,
    this.serviceSlug = '',
    this.avatarUrl,
    this.onShare,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
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
        onPressed: () {
          if (Navigator.of(context).canPop()) {
            context.pop();
          } else {
            context.go('/services');
          }
        },
      ),
      title: Text(
        title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: Color(0xFF0B1C30),
        ),
      ),
    );
  }
}

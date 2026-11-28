import 'package:flutter/material.dart';

class PartnerAccountAppBar extends StatelessWidget {
  final String? avatarUrl;
  final String? badgeLabel;
  final VoidCallback? onNotificationTap;

  const PartnerAccountAppBar({
    super.key,
    this.avatarUrl,
    this.badgeLabel,
    this.onNotificationTap,
  });

  @override
  Widget build(BuildContext context) {
    return const SliverAppBar(
      pinned: true,
      elevation: 0,
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      automaticallyImplyLeading: false,
      centerTitle: true,
      title: Text(
        'Tài khoản',
        style: TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 17,
          color: Color(0xFF0B1C30),
        ),
      ),
    );
  }
}

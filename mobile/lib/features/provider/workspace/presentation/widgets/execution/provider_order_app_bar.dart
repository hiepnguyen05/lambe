import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ProviderOrderAppBar extends StatelessWidget
    implements PreferredSizeWidget {
  final VoidCallback? onBack;
  final Widget? safetyAction;

  const ProviderOrderAppBar({super.key, this.onBack, this.safetyAction});

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  void _goBack(BuildContext context) {
    if (onBack != null) {
      onBack!();
    } else if (GoRouter.of(context).canPop()) {
      context.pop();
    } else {
      context.go('/provider/orders');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppBar(
      elevation: 0,
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      centerTitle: true,
      leading: IconButton(
        tooltip: 'Quay lại',
        onPressed: () => _goBack(context),
        icon: const Icon(
          Icons.arrow_back_ios_new_rounded,
          size: 19,
          color: Color(0xFF0B1C30),
        ),
      ),
      title: const Text(
        'Chi tiết đơn hàng',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: Color(0xFF0B1C30),
        ),
      ),
      actions: [if (safetyAction != null) safetyAction!],
    );
  }
}

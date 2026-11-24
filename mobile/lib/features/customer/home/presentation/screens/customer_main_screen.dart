import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../widgets/home_customer_bottom_nav_bar.dart';

class CustomerMainScreen extends StatelessWidget {
  final StatefulNavigationShell navigationShell;

  const CustomerMainScreen({super.key, required this.navigationShell});

  void _onTap(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: HomeCustomerBottomNavBar(
        currentIndex: navigationShell.currentIndex,
        onTabSelected: _onTap,
      ),
    );
  }
}

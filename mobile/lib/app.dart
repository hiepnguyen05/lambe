import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/screens/customer_auth_screen.dart';
import 'features/splash/presentation/screens/splash_screen.dart';

class LambeApp extends ConsumerStatefulWidget {
  const LambeApp({super.key});

  @override
  ConsumerState<LambeApp> createState() => _LambeAppState();
}

class _LambeAppState extends ConsumerState<LambeApp> {
  bool _showSplash = true;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lambe Beauty',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: _showSplash
          ? SplashScreen(
              onInitializationComplete: () {
                setState(() => _showSplash = false);
              },
            )
          : const CustomerAuthScreen(),
    );
  }
}

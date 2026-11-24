import 'package:flutter/material.dart';

class OnboardingPageWrapper extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget child;

  const OnboardingPageWrapper({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              color: Color(0xFF0B1C30),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: const TextStyle(
              fontSize: 15,
              color: Color(0xFF3E4947),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 32),
          child is Expanded
              ? child
              : Expanded(child: SingleChildScrollView(child: child)),
        ],
      ),
    );
  }
}

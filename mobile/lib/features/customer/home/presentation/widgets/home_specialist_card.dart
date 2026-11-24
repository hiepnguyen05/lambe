import 'package:flutter/material.dart';
import 'package:mobile/core/widgets/app_specialist_card.dart';

export 'package:mobile/core/widgets/app_specialist_card.dart';

/// Adapter giữ tương thích ngược cho màn hình trang chủ
class HomeSpecialistCard extends StatelessWidget {
  final SpecialistItem specialist;
  final VoidCallback? onBookTap;
  final VoidCallback? onCardTap;

  const HomeSpecialistCard({
    super.key,
    required this.specialist,
    this.onBookTap,
    this.onCardTap,
  });

  @override
  Widget build(BuildContext context) {
    return AppSpecialistCard.fromSpecialistItem(
      specialist: specialist,
      onBookTap: onBookTap,
      onCardTap: onCardTap,
    );
  }
}

import 'package:flutter/material.dart';

class OnboardingIconWidget extends StatelessWidget {
  final String? iconStr;
  final double size;
  final Color? color;

  const OnboardingIconWidget({
    super.key,
    this.iconStr,
    this.size = 20,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    if (iconStr == null || iconStr!.isEmpty) {
      return Icon(Icons.category, size: size, color: color);
    }

    if (iconStr!.startsWith('http://') || iconStr!.startsWith('https://')) {
      return Image.network(
        iconStr!,
        width: size,
        height: size,
        errorBuilder: (_, __, ___) =>
            Icon(Icons.category, size: size, color: color),
      );
    }

    IconData iconData;
    switch (iconStr!.trim().toLowerCase()) {
      case 'face_6':
        iconData = Icons.face_6;
        break;
      case 'face_3':
        iconData = Icons.face_3;
        break;
      case 'face':
        iconData = Icons.face;
        break;
      case 'content_cut':
      case 'cut':
      case 'scissors':
        iconData = Icons.content_cut;
        break;
      case 'spa':
        iconData = Icons.spa;
        break;
      case 'brush':
        iconData = Icons.brush;
        break;
      case 'clean_hands':
        iconData = Icons.clean_hands;
        break;
      case 'style':
        iconData = Icons.style;
        break;
      case 'dry_cleaning':
        iconData = Icons.dry_cleaning;
        break;
      case 'content_paste':
        iconData = Icons.content_paste;
        break;
      case 'shield':
      case 'security':
        iconData = Icons.shield;
        break;
      case 'palette':
        iconData = Icons.palette;
        break;
      case 'auto_fix_high':
        iconData = Icons.auto_fix_high;
        break;
      case 'favorite':
        iconData = Icons.favorite;
        break;
      default:
        iconData = Icons.content_cut;
        break;
    }

    return Icon(iconData, size: size, color: color);
  }
}

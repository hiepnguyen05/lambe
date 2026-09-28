import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

/// LAMBE Unified Design System - Typography Tokens (Inter)
class AppTypography {
  AppTypography._();

  static TextStyle get headlineXl => GoogleFonts.inter(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        height: 40 / 32,
        letterSpacing: -0.64, // -0.02em
        color: AppColors.onSurface,
      );

  static TextStyle get headlineLg => GoogleFonts.inter(
        fontSize: 24,
        fontWeight: FontWeight.w700,
        height: 32 / 24,
        letterSpacing: -0.24, // -0.01em
        color: AppColors.onSurface,
      );

  static TextStyle get headlineMd => GoogleFonts.inter(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        height: 28 / 20,
        color: AppColors.onSurface,
      );

  static TextStyle get headlineSm => GoogleFonts.inter(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        height: 24 / 18,
        color: AppColors.onSurface,
      );

  static TextStyle get bodyLg => GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 24 / 16,
        color: AppColors.onSurface,
      );

  static TextStyle get bodyMd => GoogleFonts.inter(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 20 / 14,
        color: AppColors.onSurfaceVariant,
      );

  static TextStyle get labelMd => GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        height: 16 / 12,
        letterSpacing: 0.60, // 0.05em
        color: AppColors.onSurfaceVariant,
      );

  static TextStyle get button => GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        height: 24 / 16,
        color: AppColors.onPrimary,
      );
}

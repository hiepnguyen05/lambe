import 'package:flutter/material.dart';
import 'app_colors.dart';
import 'app_radii.dart';
import 'app_typography.dart';

/// LAMBE Unified Design System - ThemeData Configuration
class AppTheme {
  AppTheme._();

  static ThemeData get lightTheme {
    const colorScheme = ColorScheme(
      brightness: Brightness.light,
      primary: AppColors.primary,
      onPrimary: AppColors.onPrimary,
      primaryContainer: AppColors.primaryContainer,
      onPrimaryContainer: AppColors.onPrimaryContainer,
      secondary: AppColors.secondary,
      onSecondary: AppColors.onSecondary,
      secondaryContainer: AppColors.secondaryContainer,
      onSecondaryContainer: AppColors.onSecondaryContainer,
      tertiary: AppColors.tertiary,
      onTertiary: AppColors.onTertiary,
      tertiaryContainer: AppColors.tertiaryContainer,
      onTertiaryContainer: AppColors.onTertiaryContainer,
      error: AppColors.error,
      onError: AppColors.onError,
      errorContainer: AppColors.errorContainer,
      onErrorContainer: AppColors.onErrorContainer,
      surface: AppColors.surface,
      onSurface: AppColors.onSurface,
      onSurfaceVariant: AppColors.onSurfaceVariant,
      outline: AppColors.outline,
      outlineVariant: AppColors.outlineVariant,
      inverseSurface: AppColors.inverseSurface,
      onInverseSurface: AppColors.inverseOnSurface,
      inversePrimary: AppColors.inversePrimary,
      surfaceTint: AppColors.surfaceTint,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: AppColors.background,

      // Typography
      textTheme: TextTheme(
        headlineLarge: AppTypography.headlineXl,
        headlineMedium: AppTypography.headlineLg,
        headlineSmall: AppTypography.headlineMd,
        titleLarge: AppTypography.headlineSm,
        bodyLarge: AppTypography.bodyLg,
        bodyMedium: AppTypography.bodyMd,
        labelMedium: AppTypography.labelMd,
      ),

      // App Bar
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.onSurface,
        centerTitle: false,
        titleTextStyle: AppTypography.headlineSm,
      ),

      // Buttons (8px radius, solid Teal primary)
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryContainer,
          foregroundColor: AppColors.onPrimary,
          minimumSize: const Size(double.infinity, 48),
          elevation: 0,
          shape: const RoundedRectangleBorder(
            borderRadius: AppRadii.borderDefault, // 8px radius
          ),
          textStyle: AppTypography.button,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.secondary,
          minimumSize: const Size(double.infinity, 48),
          side: const BorderSide(color: AppColors.outlineVariant),
          shape: const RoundedRectangleBorder(
            borderRadius: AppRadii.borderDefault, // 8px radius
          ),
          textStyle: AppTypography.button.copyWith(color: AppColors.secondary),
        ),
      ),

      // Input Fields (48px standard height, 8px radius, Outline border)
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceContainerLowest,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: const OutlineInputBorder(
          borderRadius: AppRadii.borderDefault,
          borderSide: BorderSide(color: AppColors.outlineVariant),
        ),
        enabledBorder: const OutlineInputBorder(
          borderRadius: AppRadii.borderDefault,
          borderSide: BorderSide(color: AppColors.outlineVariant),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: AppRadii.borderDefault,
          borderSide: BorderSide(color: AppColors.primary, width: 1.5),
        ),
        errorBorder: const OutlineInputBorder(
          borderRadius: AppRadii.borderDefault,
          borderSide: BorderSide(color: AppColors.error),
        ),
        hintStyle: AppTypography.bodyMd.copyWith(color: AppColors.outline),
      ),

      // Cards (Level 1: Thin 1px border in #E2E8F0, 8px radius, No heavy shadow)
      cardTheme: const CardThemeData(
        color: AppColors.surfaceContainerLowest,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.borderDefault,
          side: BorderSide(color: AppColors.outlineVariant, width: 1),
        ),
      ),

      // Bottom Navigation Bar
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surfaceContainerLowest,
        selectedItemColor: AppColors.primary,
        unselectedItemColor: AppColors.secondary,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
      ),

      // Divider
      dividerTheme: const DividerThemeData(
        color: AppColors.surfaceContainerHigh,
        thickness: 1,
        space: 1,
      ),
    );
  }
}

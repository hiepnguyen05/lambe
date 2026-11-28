import 'package:flutter/material.dart';

import 'package:mobile/core/theme/app_colors.dart';

class AppTheme {
  AppTheme._();

  static const String fontFamilyName = 'PlusJakartaSans';

  static ThemeData get lightTheme {
    final baseTextTheme = ThemeData.light().textTheme;
    final plusJakartaTextTheme = baseTextTheme.apply(
      fontFamily: fontFamilyName,
    );

    return ThemeData(
      useMaterial3: true,
      fontFamily: fontFamilyName,
      colorScheme: const ColorScheme(
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
        surfaceContainerLowest: AppColors.surfaceContainerLowest,
        surfaceContainerLow: AppColors.surfaceContainerLow,
        surfaceContainer: AppColors.surfaceContainer,
        surfaceContainerHigh: AppColors.surfaceContainerHigh,
        surfaceContainerHighest: AppColors.surfaceContainerHighest,
        onSurfaceVariant: AppColors.onSurfaceVariant,
        outline: AppColors.outline,
        outlineVariant: AppColors.outlineVariant,
        inverseSurface: AppColors.inverseSurface,
        onInverseSurface: AppColors.inverseOnSurface,
        inversePrimary: AppColors.inversePrimary,
      ),
      scaffoldBackgroundColor: AppColors.surface,
      canvasColor: AppColors.surface,
      cardColor: AppColors.surfaceContainerLowest,
      cardTheme: CardThemeData(
        color: AppColors.surfaceContainerLowest,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: AppColors.outlineVariant.withValues(alpha: 0.35),
            width: 1,
          ),
        ),
      ),
      textTheme: plusJakartaTextTheme.copyWith(
        displayLarge: plusJakartaTextTheme.displayLarge?.copyWith(
          fontSize: 36,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.72,
          color: AppColors.onSurface,
        ),
        displayMedium: plusJakartaTextTheme.displayMedium?.copyWith(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.64,
          color: AppColors.onSurface,
        ),
        displaySmall: plusJakartaTextTheme.displaySmall?.copyWith(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.56,
          color: AppColors.onSurface,
        ),
        headlineLarge: plusJakartaTextTheme.headlineLarge?.copyWith(
          fontSize: 26,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
          color: AppColors.onSurface,
        ),
        headlineMedium: plusJakartaTextTheme.headlineMedium?.copyWith(
          fontSize: 22,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.25,
          color: AppColors.onSurface,
        ),
        headlineSmall: plusJakartaTextTheme.headlineSmall?.copyWith(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.2,
          color: AppColors.onSurface,
        ),
        titleLarge: plusJakartaTextTheme.titleLarge?.copyWith(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.2,
          color: AppColors.onSurface,
        ),
        titleMedium: plusJakartaTextTheme.titleMedium?.copyWith(
          fontSize: 15,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.15,
          color: AppColors.onSurface,
        ),
        titleSmall: plusJakartaTextTheme.titleSmall?.copyWith(
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
          color: AppColors.onSurface,
        ),
        bodyLarge: plusJakartaTextTheme.bodyLarge?.copyWith(
          fontSize: 15,
          fontWeight: FontWeight.w400,
          color: AppColors.onSurface,
          height: 1.4,
        ),
        bodyMedium: plusJakartaTextTheme.bodyMedium?.copyWith(
          fontSize: 13.5,
          fontWeight: FontWeight.w400,
          color: AppColors.onSurface,
          height: 1.4,
        ),
        bodySmall: plusJakartaTextTheme.bodySmall?.copyWith(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          color: AppColors.textMuted,
          height: 1.35,
        ),
        labelLarge: plusJakartaTextTheme.labelLarge?.copyWith(
          fontSize: 13.5,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.1,
          color: AppColors.onSurface,
        ),
        labelMedium: plusJakartaTextTheme.labelMedium?.copyWith(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
          color: AppColors.onSurface,
        ),
        labelSmall: plusJakartaTextTheme.labelSmall?.copyWith(
          fontSize: 10.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.8,
          color: AppColors.primary,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.surface,
        foregroundColor: AppColors.onSurface,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleTextStyle: const TextStyle(
          fontFamily: fontFamilyName,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: AppColors.onSurface,
          letterSpacing: -0.3,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primaryContainer,
          foregroundColor: AppColors.onPrimary,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(100),
          ),
          textStyle: const TextStyle(
            fontFamily: fontFamilyName,
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primaryContainer,
          side: const BorderSide(color: AppColors.primaryContainer),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(100),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          textStyle: const TextStyle(
            fontFamily: fontFamilyName,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primaryContainer,
          textStyle: const TextStyle(
            fontFamily: fontFamilyName,
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surfaceContainerLowest,
        modalBackgroundColor: AppColors.surfaceContainerLowest,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.surfaceContainerLowest,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
        ),
        titleTextStyle: const TextStyle(
          fontFamily: fontFamilyName,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          color: AppColors.onSurface,
        ),
        contentTextStyle: const TextStyle(
          fontFamily: fontFamilyName,
          fontSize: 13.5,
          color: AppColors.textMuted,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.surfaceContainerLowest,
        selectedColor: AppColors.primaryContainer,
        secondarySelectedColor: AppColors.primaryContainer,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        labelStyle: const TextStyle(
          fontFamily: fontFamilyName,
          fontSize: 12.5,
          fontWeight: FontWeight.w500,
          color: AppColors.onSurfaceVariant,
        ),
        secondaryLabelStyle: const TextStyle(
          fontFamily: fontFamilyName,
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(100),
          side: BorderSide(
            color: AppColors.outlineVariant.withValues(alpha: 0.45),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceContainerLowest,
        hintStyle: const TextStyle(
          fontFamily: fontFamilyName,
          fontSize: 13.5,
          fontWeight: FontWeight.w400,
          color: AppColors.textMuted,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: AppColors.outlineVariant.withValues(alpha: 0.45),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: AppColors.outlineVariant.withValues(alpha: 0.45),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(
            color: AppColors.primaryContainer,
            width: 1.5,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(
            color: AppColors.error,
            width: 1.2,
          ),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: AppColors.surfaceContainer.withValues(alpha: 0.6),
        thickness: 1,
        space: 1,
      ),
    );
  }
}

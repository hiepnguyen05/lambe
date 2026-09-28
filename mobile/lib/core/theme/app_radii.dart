import 'package:flutter/material.dart';

/// LAMBE Unified Design System - Rounded Corner Tokens
class AppRadii {
  AppRadii._();

  static const double sm = 4.0;
  static const double defaultRadius = 8.0;
  static const double md = 12.0;
  static const double lg = 16.0;
  static const double xl = 24.0;
  static const double full = 9999.0;

  static const BorderRadius borderSm = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius borderDefault = BorderRadius.all(Radius.circular(defaultRadius));
  static const BorderRadius borderMd = BorderRadius.all(Radius.circular(md));
  static const BorderRadius borderLg = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius borderXl = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius borderFull = BorderRadius.all(Radius.circular(full));
}

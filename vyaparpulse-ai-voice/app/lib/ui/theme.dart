import 'package:flutter/material.dart';

/// Painted shop-board palette, shared with the web console so the two screens
/// read as one product.
class Palette {
  static const board = Color(0xFF0D2B26);
  static const boardDeep = Color(0xFF081C19);
  static const surface = Color(0xFF12352F);
  static const chalk = Color(0xFFF4EFE2);
  static const chalkDim = Color(0xFFA8B8B2);
  static const marigold = Color(0xFFF2A005);
  static const paid = Color(0xFF55C47C);
  static const alert = Color(0xFFE4614A);
  static const rule = Color(0x24F4EFE2);
}

ThemeData buildTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: Palette.board,
    colorScheme: base.colorScheme.copyWith(
      primary: Palette.marigold,
      secondary: Palette.paid,
      surface: Palette.surface,
      error: Palette.alert,
      onPrimary: Palette.boardDeep,
      onSurface: Palette.chalk,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Palette.board,
      foregroundColor: Palette.chalk,
      elevation: 0,
      centerTitle: false,
    ),
    textTheme: base.textTheme.apply(
      bodyColor: Palette.chalk,
      displayColor: Palette.chalk,
    ),
    dividerColor: Palette.rule,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Palette.boardDeep,
      hintStyle: const TextStyle(color: Palette.chalkDim),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Palette.rule),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Palette.rule),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Palette.marigold, width: 2),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: Palette.surface,
      contentTextStyle: TextStyle(color: Palette.chalk),
      behavior: SnackBarBehavior.floating,
    ),
  );
}

/// Uppercase, letter-spaced label — the signage voice used for section heads.
class SectionLabel extends StatelessWidget {
  final String text;
  const SectionLabel(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          letterSpacing: 1.8,
          fontWeight: FontWeight.bold,
          color: Palette.chalkDim,
        ),
      );
}

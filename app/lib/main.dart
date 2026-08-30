import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import 'config.dart';
import 'ui/home_page.dart';
import 'ui/theme.dart';

/// Merchant Voice Agent — the shop-counter screen.
///
/// The phone is a microphone and a display. Speech recognition, the "Merc"
/// wake word and transaction extraction all live in the backend, so there is
/// one implementation of that logic instead of two drifting ones.
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppConfig.load();
  await Permission.microphone.request();
  runApp(const MerchantVoiceApp());
}

class MerchantVoiceApp extends StatelessWidget {
  const MerchantVoiceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Merchant Voice Agent',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: const HomePage(),
    );
  }
}

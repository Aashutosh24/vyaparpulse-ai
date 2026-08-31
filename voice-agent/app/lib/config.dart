import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:shared_preferences/shared_preferences.dart';

/// Where the voice-agent backend lives.
///
/// The backend runs on the shop's own machine, so the address changes with the
/// network. It's editable in the app and remembered between launches.
class AppConfig {
  static const _prefsKey = 'backend_url';

  static String backendUrl = defaultUrl;

  /// A sensible starting point per platform. An Android emulator reaches the
  /// host machine at 10.0.2.2; a real phone needs the laptop's LAN IP, which
  /// the merchant sets in Settings.
  static String get defaultUrl {
    if (kIsWeb) return 'http://127.0.0.1:8000';
    if (Platform.isAndroid) return 'http://10.0.2.2:8000';
    return 'http://127.0.0.1:8000';
  }

  static Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    backendUrl = prefs.getString(_prefsKey) ?? defaultUrl;
  }

  static Future<void> save(String url) async {
    backendUrl = normalize(url);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsKey, backendUrl);
  }

  /// Accepts "192.168.1.7", "192.168.1.7:8000" or a full URL.
  static String normalize(String raw) {
    var url = raw.trim();
    if (url.isEmpty) return defaultUrl;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://$url';
    }
    if (!RegExp(r':\d+').hasMatch(url.split('//').last)) {
      url = '$url:8000';
    }
    return url.endsWith('/') ? url.substring(0, url.length - 1) : url;
  }

  static Uri http(String path) => Uri.parse('$backendUrl$path');

  static Uri ws(String path) {
    final base = backendUrl.replaceFirst(RegExp(r'^http'), 'ws');
    return Uri.parse('$base$path');
  }
}

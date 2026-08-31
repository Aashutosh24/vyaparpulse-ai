import 'package:flutter/material.dart';

import '../config.dart';
import '../services/api_client.dart';
import 'theme.dart';

/// Where the merchant points the app at their backend. On a real phone this is
/// the laptop's LAN address; on an emulator it's 10.0.2.2.
class SettingsSheet extends StatefulWidget {
  const SettingsSheet({super.key});

  @override
  State<SettingsSheet> createState() => _SettingsSheetState();
}

class _SettingsSheetState extends State<SettingsSheet> {
  late final TextEditingController _controller =
      TextEditingController(text: AppConfig.backendUrl);
  String? _result;
  bool _checking = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _saveAndTest() async {
    setState(() {
      _checking = true;
      _result = null;
    });

    await AppConfig.save(_controller.text);
    final api = ApiClient();
    final health = await api.health();
    api.close();

    if (!mounted) return;
    setState(() {
      _checking = false;
      _controller.text = AppConfig.backendUrl;
      _result = health.reachable
          ? (health.speechReady
              ? 'Connected. Speech model loaded.'
              : 'Connected, but no speech model: ${health.error ?? "unknown"}')
          : 'No answer from ${AppConfig.backendUrl}.';
    });

    if (health.reachable && mounted) {
      await Future<void>.delayed(const Duration(milliseconds: 600));
      if (mounted) Navigator.pop(context, true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionLabel('Backend address'),
          const SizedBox(height: 10),
          TextField(
            controller: _controller,
            autocorrect: false,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(hintText: '192.168.1.7:8000'),
            onSubmitted: (_) => _saveAndTest(),
          ),
          const SizedBox(height: 10),
          const Text(
            'Run the backend on your computer, then put its address here. '
            'Find it with ipconfig (Windows) or ifconfig (Mac/Linux). '
            'An Android emulator reaches the host at 10.0.2.2:8000. '
            'Phone and computer must be on the same Wi-Fi.',
            style: TextStyle(fontSize: 12, color: Palette.chalkDim, height: 1.4),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _checking ? null : _saveAndTest,
              style: FilledButton.styleFrom(
                backgroundColor: Palette.marigold,
                foregroundColor: Palette.boardDeep,
                shape: const RoundedRectangleBorder(),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: Text(_checking ? 'Checking…' : 'Save and test',
                  style: const TextStyle(letterSpacing: 1.2, fontWeight: FontWeight.bold)),
            ),
          ),
          if (_result != null) ...[
            const SizedBox(height: 12),
            Text(_result!, style: const TextStyle(fontSize: 13)),
          ],
        ],
      ),
    );
  }
}

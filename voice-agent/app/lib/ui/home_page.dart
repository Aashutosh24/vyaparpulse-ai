import 'dart:async';

import 'package:flutter/material.dart';

import '../config.dart';
import '../models/transaction.dart';
import '../services/api_client.dart';
import '../services/voice_client.dart';
import 'settings_sheet.dart';
import 'theme.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final _api = ApiClient();
  final _voice = VoiceClient();
  final _typeController = TextEditingController();

  StreamSubscription<VoiceEvent>? _eventSub;
  StreamSubscription<VoiceMode>? _modeSub;
  Timer? _poll;

  List<Transaction> _transactions = [];
  DaySummary _summary = const DaySummary();
  VoiceMode _mode = VoiceMode.off;
  String _ribbon = 'Connecting to the backend…';
  bool _ribbonIsLive = false;
  bool _wakeEnabled = false;
  bool _holding = false;
  String? _banner;

  @override
  void initState() {
    super.initState();
    _eventSub = _voice.events.listen(_onVoiceEvent);
    _modeSub = _voice.modes.listen((m) => setState(() => _mode = m));
    _bootstrap();
    _poll = Timer.periodic(const Duration(seconds: 20), (_) => _refresh());
  }

  @override
  void dispose() {
    _poll?.cancel();
    _eventSub?.cancel();
    _modeSub?.cancel();
    _voice.dispose();
    _api.close();
    _typeController.dispose();
    super.dispose();
  }

  // -- data ---------------------------------------------------------------

  Future<void> _bootstrap() async {
    final health = await _api.health();
    if (!mounted) return;

    if (!health.reachable) {
      setState(() {
        _banner = 'No backend at ${AppConfig.backendUrl}. Tap the gear to fix the address.';
        _ribbon = 'Backend unreachable.';
      });
      return;
    }
    if (!health.speechReady) {
      setState(() => _banner =
          health.error ?? 'Backend has no speech model. Run scripts/download_model.py.');
    } else {
      setState(() => _banner = null);
    }

    await _refresh();
    // The microphone stays shut until the merchant asks for it.
    if (mounted) {
      setState(() => _ribbon = 'Hold the button and say the sale.');
    }
  }

  Future<void> _refresh() async {
    try {
      final txns = await _api.transactions();
      final summary = await _api.summary();
      if (!mounted) return;
      setState(() {
        _transactions = txns;
        _summary = summary;
        if (_banner != null && _banner!.startsWith('No backend')) _banner = null;
      });
    } on BackendException catch (e) {
      if (mounted) setState(() => _banner = e.message);
    }
  }

  // -- voice --------------------------------------------------------------

  void _onVoiceEvent(VoiceEvent event) {
    switch (event.type) {
      case 'partial':
        if (event.text.isNotEmpty) _say(event.text, live: true);
      case 'wake':
        _say(event.text.isEmpty ? 'Listening…' : event.text, live: true);
      case 'listening':
        _say('Listening…', live: true);
      case 'timeout':
        _say(event.message.isEmpty ? 'Nothing heard.' : event.message);
      case 'heard':
        // While armed, the recognizer transcribes the whole room. Showing each
        // stray sentence makes the app look like it is acting on them.
        if (event.data['used'] == true && event.text.isNotEmpty) {
          _say(event.text, live: true);
        }
      case 'result':
        _onResult(event);
      case 'error':
        setState(() => _banner = event.message);
    }
  }

  void _onResult(VoiceEvent event) {
    final txn = event.data['transaction'] as Map<String, dynamic>?;
    if (event.data['accepted'] == true && txn != null) {
      final t = Transaction.fromJson(txn);
      _say('${t.label} — ₹${_money(t.amount)} pending');
      _toast('${t.label} · ₹${_money(t.amount)}', Palette.paid);
    } else if (event.data['cancelled'] == true) {
      _say('Cancelled the last entry.');
    } else {
      final transcript = (event.data['transcript'] as String?) ?? '';
      _say('Heard “$transcript” — ${event.data['reason']}');
    }
    _refresh();
  }

  void _say(String text, {bool live = false}) {
    if (!mounted) return;
    setState(() {
      _ribbon = text;
      _ribbonIsLive = live;
    });
  }

  void _toast(String message, Color color) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(message, style: const TextStyle(color: Palette.boardDeep)),
        backgroundColor: color,
        duration: const Duration(seconds: 2),
      ));
  }

  Future<void> _holdStart() async {
    setState(() {
      _holding = true;
      _ribbon = 'Listening…';
      _ribbonIsLive = true;
    });
    await _voice.beginPush();
  }

  Future<void> _holdEnd() async {
    if (!_holding) return;
    setState(() {
      _holding = false;
      _ribbon = 'Working it out…';
      _ribbonIsLive = true;
    });
    await _voice.endPush();
  }

  /// Hands-free is a deliberate choice, not the default: it holds the
  /// microphone open until switched off again.
  Future<void> _toggleHandsFree() async {
    final next = !_wakeEnabled;
    setState(() => _wakeEnabled = next);
    if (next) {
      await _voice.startHandsFree();
      _say(_voice.isConnected
          ? 'Hands free. Say “Merc” before each sale.'
          : 'Could not open the microphone.');
    } else {
      await _voice.stopHandsFree();
      _say('Microphone off. Hold the button to speak.');
    }
    if (mounted) setState(() {});
  }

  Future<void> _submitTyped() async {
    final text = _typeController.text.trim();
    if (text.isEmpty) return;
    _typeController.clear();
    try {
      final result = await _api.sendText(text);
      if (result.accepted && result.transaction != null) {
        _toast('${result.transaction!.label} · ₹${_money(result.transaction!.amount)}',
            Palette.paid);
      } else {
        _say('“$text” — ${result.reason}');
      }
      await _refresh();
    } on BackendException catch (e) {
      setState(() => _banner = e.message);
    }
  }

  Future<void> _togglePaid(Transaction t) async {
    try {
      await _api.setStatus(
        t.id,
        t.isPaid ? TransactionStatus.pending : TransactionStatus.paid,
      );
      await _refresh();
    } on BackendException catch (e) {
      setState(() => _banner = e.message);
    }
  }

  Future<void> _openSettings() async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Palette.surface,
      builder: (_) => const SettingsSheet(),
    );
    if (changed == true) {
      await _voice.disconnect();
      await _bootstrap();
    }
  }

  static String _money(double v) =>
      v % 1 == 0 ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  // -- ui -----------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'MERCHANT VOICE AGENT',
          style: TextStyle(fontSize: 14, letterSpacing: 2, fontWeight: FontWeight.bold),
        ),
        actions: [
          _StatusDot(mode: _mode),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Backend address',
            onPressed: _openSettings,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        color: Palette.marigold,
        backgroundColor: Palette.surface,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            if (_banner != null) _Banner(_banner!),
            const SizedBox(height: 8),
            _micSection(),
            const SizedBox(height: 20),
            _totals(),
            const SizedBox(height: 24),
            const SectionLabel("Today's transactions"),
            const SizedBox(height: 8),
            ..._transactionTiles(),
          ],
        ),
      ),
    );
  }

  Widget _micSection() {
    final listening = _holding || _mode == VoiceMode.listening;
    return Column(
      children: [
        GestureDetector(
          onTapDown: (_) => _holdStart(),
          onTapUp: (_) => _holdEnd(),
          onTapCancel: _holdEnd,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            width: 168,
            height: 168,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                center: const Alignment(-0.3, -0.4),
                colors: listening
                    ? const [Color(0xFF2A5C4F), Palette.boardDeep]
                    : const [Color(0xFF163D36), Palette.boardDeep],
              ),
              border: Border.all(
                color: listening ? Palette.paid : Palette.marigold,
                width: 3,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(listening ? Icons.graphic_eq : Icons.mic_none,
                    size: 40, color: listening ? Palette.paid : Palette.chalk),
                const SizedBox(height: 8),
                Text(
                  listening ? 'LISTENING' : 'HOLD TO SPEAK',
                  style: const TextStyle(
                      fontSize: 12, letterSpacing: 1.6, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 2),
                Text(
                  _wakeEnabled ? 'or say “Merc”' : 'mic opens on press',
                  style: const TextStyle(fontSize: 10, color: Palette.chalkDim),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: const BoxDecoration(
            color: Palette.boardDeep,
            border: Border(left: BorderSide(color: Palette.marigold, width: 3)),
          ),
          child: Text(
            _ribbon,
            style: TextStyle(
              fontSize: 15,
              color: _ribbonIsLive ? Palette.chalkDim : Palette.chalk,
              fontStyle: _ribbonIsLive ? FontStyle.italic : FontStyle.normal,
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _handsFreeButton()),
            const SizedBox(width: 8),
            SizedBox(
              width: 108,
              child: OutlinedButton(
                onPressed: () async {
                  await _voice.disconnect();
                  _say('Microphone closed.');
                  if (mounted) setState(() => _wakeEnabled = false);
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: Palette.chalk,
                  side: const BorderSide(color: Palette.rule),
                  shape: const RoundedRectangleBorder(),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(_voice.isConnected ? 'MIC OFF' : 'MIC IDLE',
                    style: const TextStyle(fontSize: 11, letterSpacing: 1.2)),
              ),
            ),
          ],
        ),
            

        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _typeController,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _submitTyped(),
                decoration: const InputDecoration(hintText: 'two samosas fifty rupees'),
              ),
            ),
            const SizedBox(width: 8),
            OutlinedButton(
              onPressed: _submitTyped,
              style: OutlinedButton.styleFrom(
                foregroundColor: Palette.chalk,
                side: const BorderSide(color: Palette.rule),
                shape: const RoundedRectangleBorder(),
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
              ),
              child: const Text('ADD', style: TextStyle(fontSize: 11, letterSpacing: 1.2)),
            ),
          ],
        ),
      ],
    );
  }

  Widget _handsFreeButton() => OutlinedButton(
        onPressed: _toggleHandsFree,
        style: OutlinedButton.styleFrom(
          backgroundColor: _wakeEnabled ? Palette.marigold : Colors.transparent,
          foregroundColor: _wakeEnabled ? Palette.boardDeep : Palette.chalk,
          side: const BorderSide(color: Palette.rule),
          shape: const RoundedRectangleBorder(),
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        child: Text(
          _wakeEnabled ? 'HANDS FREE ON' : 'HANDS FREE OFF',
          style: const TextStyle(fontSize: 11, letterSpacing: 1.2),
        ),
      );

  Widget _totals() {
    Widget cell(String label, String value) => Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(right: BorderSide(color: Palette.rule)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionLabel(label),
                const SizedBox(height: 4),
                Text(value,
                    style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        fontFeatures: [FontFeature.tabularFigures()])),
              ],
            ),
          ),
        );

    return Container(
      decoration: BoxDecoration(border: Border.all(color: Palette.rule)),
      child: Row(
        children: [
          cell('Sales', '${_summary.totalCount}'),
          cell('Total', '₹${_money(_summary.totalAmount)}'),
          cell('Pending', '₹${_money(_summary.pendingAmount)}'),
        ],
      ),
    );
  }

  List<Widget> _transactionTiles() {
    if (_transactions.isEmpty) {
      return [
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 28),
          child: Text('Nothing yet. Speak a sale to start the day.',
              style: TextStyle(color: Palette.chalkDim)),
        )
      ];
    }

    return _transactions.map((t) {
      final overdue = !t.isPaid && _summary.overdueIds.contains(t.id);
      final time = TimeOfDay.fromDateTime(t.timestamp).format(context);
      return Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Palette.rule)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.label, style: const TextStyle(fontSize: 15)),
                  const SizedBox(height: 2),
                  Text('$time · ${t.rawText}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: Palette.chalkDim)),
                ],
              ),
            ),
            Text('₹${_money(t.amount)}',
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    fontFeatures: [FontFeature.tabularFigures()])),
            const SizedBox(width: 10),
            GestureDetector(
              onTap: () => _togglePaid(t),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: t.isPaid
                        ? Palette.paid
                        : overdue
                            ? Palette.alert
                            : Palette.marigold,
                  ),
                ),
                child: Text(
                  t.isPaid ? 'PAID' : (overdue ? 'OVERDUE' : 'PENDING'),
                  style: TextStyle(
                    fontSize: 9,
                    letterSpacing: 1,
                    color: t.isPaid
                        ? Palette.paid
                        : overdue
                            ? Palette.alert
                            : Palette.marigold,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }).toList();
  }
}

class _StatusDot extends StatelessWidget {
  final VoiceMode mode;
  const _StatusDot({required this.mode});

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (mode) {
      VoiceMode.listening => (Palette.paid, 'listening'),
      VoiceMode.armed => (Palette.marigold, 'armed'),
      VoiceMode.connecting => (Palette.chalkDim, 'connecting'),
      VoiceMode.error => (Palette.alert, 'error'),
      VoiceMode.off => (Palette.chalkDim, 'mic off'),
    };
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Text(label.toUpperCase(),
            style: const TextStyle(
                fontSize: 10, letterSpacing: 1.2, color: Palette.chalkDim)),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  final String message;
  const _Banner(this.message);

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        color: Palette.alert,
        child: Text(message,
            style: const TextStyle(color: Color(0xFF150605), fontSize: 13)),
      );
}

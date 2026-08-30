import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:record/record.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/status.dart' as ws_status;

import '../config.dart';

/// What the phone is doing right now. Mirrors the backend's own modes.
enum VoiceMode { off, connecting, armed, listening, error }

/// One event from the backend's speech pipeline.
class VoiceEvent {
  final String type; // partial | heard | wake | listening | timeout | result | state | error
  final Map<String, dynamic> data;
  const VoiceEvent(this.type, this.data);

  String get text => (data['text'] as String?) ?? '';
  String get message => (data['message'] as String?) ?? '';
}

/// Streams the microphone to the backend and relays what comes back.
///
/// The phone does no speech recognition of its own — it is a microphone and a
/// screen. The backend holds the model, the wake word and the extractor, so
/// there is exactly one place where any of that behaviour can be wrong.
///
/// Two modes, and the mic is shut in both until asked for:
///
///   push to talk  hold the button, speak, release. Audio only leaves the
///                 device while the button is down; the mic itself stays open
///                 and idle afterwards so the next press catches the first
///                 word. "MIC OFF" closes it properly.
///   hands free    an explicit opt-in. The mic stays open listening for the
///                 wake word, which is what you want on a busy counter and
///                 not what you want by default.
class VoiceClient {
  final AudioRecorder _recorder = AudioRecorder();
  WebSocketChannel? _channel;
  StreamSubscription<Uint8List>? _micSub;
  StreamSubscription? _wsSub;

  /// Audio is captured continuously once the mic is open, but only forwarded
  /// while the button is down. The rest is kept in a short rolling buffer and
  /// sent on press, so the first word isn't lost to connection setup.
  bool _sending = false;
  final List<Uint8List> _preroll = [];
  static const int _prerollChunks = 8; // roughly half a second

  final _events = StreamController<VoiceEvent>.broadcast();
  final _modes = StreamController<VoiceMode>.broadcast();

  Stream<VoiceEvent> get events => _events.stream;
  Stream<VoiceMode> get modes => _modes.stream;

  VoiceMode _mode = VoiceMode.off;
  VoiceMode get mode => _mode;
  bool get isConnected => _channel != null;

  /// True only while the merchant has deliberately turned on wake-word mode.
  bool handsFree = false;

  /// Vosk wants 16 kHz mono; the backend confirms the rate in its hello.
  static const int sampleRate = 16000;

  void _setMode(VoiceMode mode) {
    _mode = mode;
    if (!_modes.isClosed) _modes.add(mode);
  }

  void _emit(String type, [Map<String, dynamic> data = const {}]) {
    if (!_events.isClosed) _events.add(VoiceEvent(type, data));
  }

  /// Opens the mic and the socket. Safe to call when already running.
  Future<void> connect({bool wakeEnabled = true}) async {
    if (isConnected) return;
    _setMode(VoiceMode.connecting);

    if (!await _recorder.hasPermission()) {
      _setMode(VoiceMode.error);
      _emit('error', {'message': 'Microphone permission denied.'});
      return;
    }

    try {
      final channel = WebSocketChannel.connect(AppConfig.ws('/ws/audio'));
      await channel.ready;
      _channel = channel;

      _wsSub = channel.stream.listen(
        _onServerMessage,
        onError: (Object e) {
          _emit('error', {'message': 'Connection lost: $e'});
          disconnect();
        },
        onDone: disconnect,
      );

      if (!wakeEnabled) setWakeEnabled(false);

      final micStream = await _recorder.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bits,
          sampleRate: sampleRate,
          numChannels: 1,
        ),
      );
      _micSub = micStream.listen(
        _onAudioChunk,
        onError: (Object e) => _emit('error', {'message': 'Microphone: $e'}),
      );

      _setMode(wakeEnabled ? VoiceMode.armed : VoiceMode.listening);
    } catch (e) {
      _setMode(VoiceMode.error);
      _emit('error', {
        'message': 'Could not reach ${AppConfig.backendUrl}. Check the address in Settings.',
      });
      await disconnect();
    }
  }

  void _onAudioChunk(Uint8List chunk) {
    if (_sending) {
      _channel?.sink.add(chunk);
      return;
    }
    // Idle: remember the last half second in case the button is pressed a
    // moment after the merchant starts speaking.
    _preroll.add(chunk);
    if (_preroll.length > _prerollChunks) _preroll.removeAt(0);
  }

  void _onServerMessage(dynamic raw) {
    Map<String, dynamic> event;
    try {
      event = jsonDecode(raw as String) as Map<String, dynamic>;
    } catch (_) {
      return;
    }

    final type = (event['type'] as String?) ?? 'unknown';
    if (type == 'state' || type == 'hello') {
      final backendMode = event['mode'] as String?;
      _setMode(backendMode == 'listening' ? VoiceMode.listening : VoiceMode.armed);
    } else if (type == 'listening') {
      _setMode(VoiceMode.listening);
    }
    _emit(type, event);
  }

  /// Button pressed. Opens the mic the first time, then keeps it open so the
  /// next press is instant — reconnecting mid-sentence is what swallowed the
  /// leading count.
  Future<void> beginPush() async {
    if (!isConnected) {
      await connect(wakeEnabled: false);
      if (!isConnected) return;
    }

    // "buffered" tells the backend the button defines the sentence, so a
    // pause after "two" doesn't file a two-rupee sale.
    _channel?.sink.add(jsonEncode({'action': 'listen', 'buffered': true}));

    for (final chunk in _preroll) {
      _channel?.sink.add(chunk);
    }
    _preroll.clear();
    _sending = true;
  }

  /// Button released. Ends the utterance immediately rather than waiting for a
  /// pause, and waits briefly for the answer. The mic stays open and idle.
  Future<void> endPush() async {
    if (!_sending || !isConnected) return;
    _sending = handsFree;

    final answered = events.firstWhere((e) => e.type == 'result');
    _channel?.sink.add(jsonEncode({'action': 'flush'}));
    try {
      await answered.timeout(const Duration(seconds: 4));
    } catch (_) {
      // No answer in time; the mic stays usable either way.
    }
  }

  /// Hands-free: mic stays open, waiting for the wake word.
  Future<void> startHandsFree() async {
    handsFree = true;
    await connect(wakeEnabled: true);
    if (!isConnected) {
      handsFree = false;
      return;
    }
    // The wake word can only be heard if audio actually leaves the device.
    _preroll.clear();
    _sending = true;
  }

  Future<void> stopHandsFree() async {
    handsFree = false;
    await disconnect();
  }

  void setWakeEnabled(bool enabled) {
    _channel?.sink.add(jsonEncode({'action': 'wake', 'enabled': enabled}));
  }

  Future<void> disconnect() async {
    _sending = false;
    _preroll.clear();
    await _micSub?.cancel();
    _micSub = null;
    if (await _recorder.isRecording()) {
      await _recorder.stop();
    }
    await _wsSub?.cancel();
    _wsSub = null;
    await _channel?.sink.close(ws_status.normalClosure);
    _channel = null;
    _setMode(VoiceMode.off);
  }

  Future<void> dispose() async {
    await disconnect();
    await _recorder.dispose();
    await _events.close();
    await _modes.close();
  }
}

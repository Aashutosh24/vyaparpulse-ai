import 'dart:js_interop';
import 'dart:js_interop_unsafe';
import 'package:flutter/foundation.dart' show kIsWeb;

/// Announces transaction results aloud and plays a soundbox chime tone
/// so the shopkeeper knows what was added without looking at the phone.
class AudioFeedback {
  /// Whether audio feedback is enabled (toggled by the merchant in settings).
  bool enabled = true;

  Future<void> init() async {
    // Web Speech and Web Audio are initialized on demand
  }

  /// Announces a transaction: plays a payment chime + speaks item & amount.
  /// Examples:
  ///   - "2 Samosa, 50 rupees added"
  ///   - "Tea, 20 rupees added"
  ///   - "45 rupees added"
  void announceTransaction({
    String? item,
    int? quantity,
    required double amount,
  }) {
    if (!enabled) return;
    final amtStr = _fmt(amount);
    String text;
    if (item != null && item.trim().isNotEmpty) {
      final cleanItem = item.trim();
      if (quantity != null && quantity > 1) {
        text = '$quantity $cleanItem, $amtStr rupees added';
      } else {
        text = '$cleanItem, $amtStr rupees added';
      }
    } else {
      text = '$amtStr rupees added';
    }

    _playFeedback(text, isSuccess: true);
  }

  /// Announced on undo / cancel.
  void announceCancelled() {
    if (!enabled) return;
    _playFeedback('Transaction cancelled', isSuccess: false);
  }

  void say(String text) {
    if (!enabled) return;
    _playFeedback(text, isSuccess: true);
  }

  void _playFeedback(String text, {bool isSuccess = true}) {
    if (kIsWeb) {
      _playWebFeedback(text, isSuccess);
    }
  }

  void _playWebFeedback(String text, bool isSuccess) {
    try {
      final jsFunc = globalContext.callMethod(
        'eval'.toJS,
        '''
(function(text, isSuccess) {
  try {
    // 1. Play Soundbox confirmation chime tone using Web Audio
    var AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      var ctx = new AudioContext();
      var now = ctx.currentTime;
      
      if (isSuccess) {
        // High 2-tone chime: D5 (587Hz) -> A5 (880Hz)
        var osc1 = ctx.createOscillator();
        var gain1 = ctx.createGain();
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.18);

        var osc2 = ctx.createOscillator();
        var gain2 = ctx.createGain();
        osc2.frequency.setValueAtTime(880.0, now + 0.15);
        gain2.gain.setValueAtTime(0.25, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.45);
      } else {
        // Cancel tone: 440Hz -> 330Hz
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.frequency.setValueAtTime(440.0, now);
        osc.frequency.linearRampToValueAtTime(330.0, now + 0.25);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    }

    // 2. Announce the spoken words aloud
    setTimeout(function() {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-IN';
        u.rate = 1.02;
        u.pitch = 1.05;
        window.speechSynthesis.speak(u);
      }
    }, isSuccess ? 300 : 200);
  } catch (err) {
    if (window.speechSynthesis) {
      var u = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(u);
    }
  }
})
'''.toJS,
      ) as JSFunction;

      jsFunc.callAsFunction(null, text.toJS, isSuccess.toJS);
    } catch (_) {
      // Fallback
    }
  }

  String _fmt(double amount) {
    if (amount == amount.truncateToDouble()) {
      return amount.toInt().toString();
    }
    return amount.toStringAsFixed(2);
  }

  Future<void> dispose() async {
    if (kIsWeb) {
      try {
        globalContext.callMethod(
          'eval'.toJS,
          '''
(function() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
})
'''.toJS,
        );
      } catch (_) {}
    }
  }
}

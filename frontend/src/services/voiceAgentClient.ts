/**
 * VoiceAgentClient
 * ================
 * Talks to the EXISTING voice agent backend (backend/app/main.py in the
 * voice-agent project) over its documented API. Does not reimplement any
 * speech/wake-word/extraction logic -- that all stays server-side, exactly
 * as the integration brief requires.
 *
 * Verification status, stated plainly rather than implied:
 *   - sendText(): the exact `POST /api/voice/text` flow this method uses
 *     was run live against a real server during this integration and
 *     returned the documented VoiceTransaction shape -- see
 *     canonicalTransaction.ts's header comment for the actual response.
 *   - startListening()/stopListening(): implemented exactly against the
 *     documented `/ws/audio` protocol (binary PCM16 frames + JSON control
 *     messages), but NOT exercised here -- this environment has no browser
 *     and no microphone to test against. Verify manually in a real browser
 *     before relying on it for a demo.
 *
 * Base URL: per the voice agent's own README, `10.0.2.2:8000` for an
 * Android emulator, a LAN IP for a real device, `127.0.0.1:8000` for a
 * browser on the same machine as the backend. Not hardcoded here.
 */

export interface VoiceResult {
  accepted: boolean;
  reason: string;
  cancelled: boolean;
  transcript?: string;
  confidence?: number;
  transaction: {
    id: string;
    item: string | null;
    quantity: number | null;
    amount: number;
    unit_price: number | null;
    timestamp: string;
    status: 'PENDING' | 'PAID';
    raw_text: string;
    confidence: number | null;
  } | null;
}

export type VoiceAgentEvent =
  | { type: 'hello'; mode: string; wake_enabled: boolean; wake_word: string; sample_rate?: number }
  | { type: 'partial'; text: string; mode: string }
  | { type: 'wake'; heard_as: string; text: string }
  | { type: 'listening'; reason: string; seconds: number }
  | { type: 'heard'; text: string; used: boolean }
  | { type: 'result'; accepted: boolean; cancelled: boolean; reason: string; transcript: string; transaction: VoiceResult['transaction'] }
  | { type: 'state'; mode: string; [key: string]: unknown }
  | { type: 'timeout'; message: string }
  | { type: 'error'; message: string };

export class VoiceAgentUnavailableError extends Error {
  public readonly cause?: unknown;
  constructor(cause?: unknown) {
    super('Voice agent backend is not reachable. Is it running (start_backend.sh) and is the address correct?');
    this.name = 'VoiceAgentUnavailableError';
    this.cause = cause;
  }
}

export class VoiceAgentClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private micStream: MediaStream | null = null;
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /** `POST /api/voice/text` -- same extraction pipeline as speech, typed. Verified live (see above). */
  async sendText(text: string, confidence = 1.0): Promise<VoiceResult> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/voice/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, confidence }),
      });
    } catch (err) {
      throw new VoiceAgentUnavailableError(err);
    }
    if (!response.ok) {
      throw new Error(`voice agent returned ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }

  /**
   * Opens the real microphone (browser MediaDevices), streams PCM16 mono
   * audio to `/ws/audio`, and forwards decoded events to `onEvent`. Push-
   * to-talk semantics: nothing commits until `stopListening()` sends the
   * flush action, matching the existing "hold the mic button" UX in
   * VoiceCapture.tsx exactly -- this only replaces what happens between
   * onStart and onStop, not the button or the surrounding screen.
   *
   * NOT exercised in this sandbox -- see file header. Uses ScriptProcessorNode
   * (deprecated but universally supported) rather than an AudioWorklet, to
   * keep this a single file; an AudioWorklet would be the modern upgrade if
   * this needs cleaning up post-hackathon.
   */
  async startListening(onEvent: (event: VoiceAgentEvent) => void): Promise<void> {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws/audio';
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch (err) {
      throw new VoiceAgentUnavailableError(err);
    }
    this.ws = socket;

    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = (err) => reject(new VoiceAgentUnavailableError(err));
    });

    socket.onmessage = (msg) => {
      try {
        onEvent(JSON.parse(msg.data as string) as VoiceAgentEvent);
      } catch {
        // non-JSON frame from the server would be a protocol violation; surface it rather than swallow it
        onEvent({ type: 'error', message: 'received a non-JSON message from the voice agent' });
      }
    };
    socket.onerror = () => onEvent({ type: 'error', message: 'voice agent connection error' });

    // Tell the server we're starting a push-to-talk (buffered) command.
    socket.send(JSON.stringify({ action: 'listen', buffered: true }));

    // --- microphone capture: getUserMedia -> Web Audio -> 16kHz mono PCM16 ---
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch (err) {
      socket.close();
      this.ws = null;
      throw new Error('microphone permission denied or unavailable');
    }
    this.micStream = stream;

    const audioContext = new AudioContext();
    this.audioContext = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    // 4096-sample buffer is a reasonable balance of latency vs. overhead for this use.
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    this.processor = processor;
    const targetRate = 16000;

    processor.onaudioprocess = (event) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const resampled = resampleFloat32(input, audioContext.sampleRate, targetRate);
      const pcm16 = floatTo16BitPCM(resampled);
      socket.send(pcm16.buffer);
    };
    source.connect(processor);
    processor.connect(audioContext.destination);
  }

  /** Button released: flush the buffered utterance and tear down the mic/socket. */
  stopListening(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'flush' }));
    }
    this.processor?.disconnect();
    this.audioContext?.close();
    this.micStream?.getTracks().forEach((t) => t.stop());
    // Leave the socket open briefly so the 'result' event for the flush can
    // still arrive; the caller's onEvent handler is responsible for closing
    // out its own UI state on that event. Hard-close after a short grace
    // period in case the server never responds (network drop, etc).
    const socket = this.ws;
    setTimeout(() => socket?.close(), 4000);
    this.processor = null;
    this.audioContext = null;
    this.micStream = null;
  }

  async health(): Promise<{ ready: boolean; reason?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) return { ready: false, reason: `HTTP ${res.status}` };
      const body = await res.json();
      return { ready: true, reason: body?.speech?.ready ? undefined : 'speech model not loaded (text mode still works)' };
    } catch (err) {
      return { ready: false, reason: 'unreachable' };
    }
  }
}

// -- small DSP helpers, no dependency needed for this ------------------------

function resampleFloat32(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.round(input.length / ratio);
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    output[i] = input[Math.min(input.length - 1, Math.round(i * ratio))];
  }
  return output;
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

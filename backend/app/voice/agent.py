"""The voice agent: microphone in, PENDING transactions out.

Two ways to trigger it, both ending in the same pipeline:

  * say "Merc ..."          — the mic loop listens for the wake word
  * press the button        — push-to-talk, no wake word needed

Both paths converge on `handle_transcript()`, which is also what the WAV upload
and the typed-text endpoints call. One extraction path, one place to fix bugs.

States:
    off       — mic loop not running
    armed     — listening for the wake word, ignoring everything else
    listening — capturing a command right now
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field

from ..config import settings
from ..events import bus
from ..models.transaction import Transaction, TransactionStatus
from ..store import catalog, store
from . import grammar, wake
from .extractor import ExtractionResult, TransactionExtractor
from .stt import engine, parse_partial, _parse_result

log = logging.getLogger(__name__)

OFF, ARMED, LISTENING = "off", "armed", "listening"


@dataclass
class AgentState:
    mode: str = OFF
    wake_enabled: bool = True
    last_transcript: str = ""
    last_partial: str = ""
    mic_error: str | None = None
    listening_until: float = 0.0
    started_at: float | None = field(default=None)


class VoiceAgent:
    def __init__(self) -> None:
        self.state = AgentState()
        self.extractor = TransactionExtractor(catalog.products)
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._lock = threading.Lock()

    # -- transcript -> transaction (shared by every input path) ----------
    def preview(self, text: str) -> ExtractionResult:
        """Extract without storing — used to ask "is this a whole order yet?"
        before deciding to wait for more words."""
        self.extractor.set_products(catalog.products)
        return self.extractor.extract(
            wake.strip_wake(text, settings.WAKE_WORD, settings.WAKE_FUZZ)
    )
    def handle_transcript(
        self,
        text: str,
        confidence: float | None = None,
        source: str = "mic",
        strip_wake_word: bool = True,
    ) -> ExtractionResult:
        text = (text or "").strip()
        if strip_wake_word:
            text = wake.strip_wake(text, settings.WAKE_WORD, settings.WAKE_FUZZ)

        self.state.last_transcript = text
        self.extractor.set_products(catalog.products)
        result = self.extractor.extract(text, confidence)

        if result.cancel:
            removed = store.last_pending()
            if removed is not None:
                store.delete(removed.id)
                bus.publish("cancelled", transaction=removed.model_dump(mode="json"), source=source)
            else:
                bus.publish("ignored", text=text, reason="nothing to cancel", source=source)
            return result

        if result.transaction is None:
            bus.publish("ignored", text=text, reason=result.reason, source=source)
            return result

        store.add(result.transaction)
        bus.publish(
            "transaction",
            transaction=result.transaction.model_dump(mode="json"),
            source=source,
            summary=store.summary(),
        )
        log.info(
            "captured %s x%s = %s from %r",
            result.transaction.item,
            result.transaction.quantity,
            result.transaction.amount,
            text,
        )
        return result

    # -- control ---------------------------------------------------------

    def start(self) -> dict:
        """Start the mic loop (idempotent)."""
        with self._lock:
            if self._thread and self._thread.is_alive():
                return self.status()
            if not engine.load():
                self.state.mic_error = engine.error
                bus.publish("error", message=engine.error or "speech model unavailable")
                return self.status()

            self._stop.clear()
            self.state.mic_error = None
            self.state.mode = ARMED if self.state.wake_enabled else LISTENING
            self.state.started_at = time.time()
            self._thread = threading.Thread(target=self._run, name="voice-agent", daemon=True)
            self._thread.start()
            bus.publish("state", **self.status())
            return self.status()

    def stop(self) -> dict:
        self._stop.set()
        thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=3)
        self._thread = None
        self.state.mode = OFF
        self.state.last_partial = ""
        bus.publish("state", **self.status())
        return self.status()

    def listen_now(self, seconds: float | None = None) -> dict:
        """The button. Opens a command window without needing the wake word."""
        window = seconds or settings.COMMAND_WINDOW_SEC
        if not (self._thread and self._thread.is_alive()):
            self.start()
            if self.state.mic_error:
                return self.status()
        self.state.mode = LISTENING
        self.state.listening_until = time.time() + window
        bus.publish("listening", reason="button", seconds=window)
        return self.status()

    def set_wake_enabled(self, enabled: bool) -> dict:
        self.state.wake_enabled = enabled
        if self.state.mode != OFF:
            self.state.mode = ARMED if enabled else LISTENING
            if not enabled:
                self.state.listening_until = time.time() + 3600
        bus.publish("state", **self.status())
        return self.status()

    def status(self) -> dict:
        remaining = max(0.0, self.state.listening_until - time.time())
        return {
            "mode": self.state.mode,
            "wake_word": settings.WAKE_WORD,
            "wake_enabled": self.state.wake_enabled,
            "listening_seconds_left": round(remaining, 1) if self.state.mode == LISTENING else 0,
            "last_transcript": self.state.last_transcript,
            "last_partial": self.state.last_partial,
            "mic_error": self.state.mic_error,
            "speech": engine.status(),
        }

    @staticmethod
    def _phrases() -> list[str]:
        """The recognizer's vocabulary, rebuilt from the current catalog."""
        return grammar.phrases_for(catalog.products, settings.WAKE_WORD)

    # -- mic loop --------------------------------------------------------

    def _run(self) -> None:
        try:
            import sounddevice as sd
        except Exception as exc:
            self.state.mic_error = (
                f"microphone unavailable ({exc}). Use the browser mic button, "
                "or install PortAudio and `pip install sounddevice`."
            )
            self.state.mode = OFF
            bus.publish("error", message=self.state.mic_error)
            return

        try:
            recognizer = engine.new_recognizer(self._phrases())
        except Exception as exc:
            self.state.mic_error = str(exc)
            self.state.mode = OFF
            bus.publish("error", message=self.state.mic_error)
            return

        block = 4000  # 0.25s at 16 kHz
        try:
            with sd.RawInputStream(
                samplerate=settings.SAMPLE_RATE,
                blocksize=block,
                dtype="int16",
                channels=1,
                device=settings.INPUT_DEVICE,
            ) as stream:
                log.info("microphone open, mode=%s", self.state.mode)
                bus.publish("state", **self.status())
                self._loop_body(stream, recognizer, block)
        except Exception as exc:
            self.state.mic_error = f"microphone error: {exc}"
            bus.publish("error", message=self.state.mic_error)
            log.exception("microphone loop failed")
        finally:
            self.state.mode = OFF
            self.state.last_partial = ""
            bus.publish("state", **self.status())

    def _loop_body(self, stream, recognizer, block: int) -> None:
        last_partial = ""
        while not self._stop.is_set():
            data, overflowed = stream.read(block)
            if overflowed:
                log.debug("input overflow — dropped a block")

            if recognizer.AcceptWaveform(bytes(data)):
                text, confidence = _parse_result(recognizer.Result())
                last_partial = ""
                self.state.last_partial = ""
                if text:
                    self._on_final(text, confidence)
            else:
                partial = parse_partial(recognizer.PartialResult())
                if partial != last_partial:
                    last_partial = partial
                    self.state.last_partial = partial
                    bus.publish("partial", text=partial, mode=self.state.mode)
                    # React to the wake word as soon as it appears, so the
                    # merchant sees the agent arm mid-sentence.
                    if self.state.mode == ARMED and partial:
                        if wake.detect(partial, settings.WAKE_WORD, settings.WAKE_FUZZ).hit:
                            self._arm_command_window("wake word")

            if (
                self.state.mode == LISTENING
                and self.state.listening_until
                and time.time() > self.state.listening_until
            ):
                self._end_command_window()

    def _on_final(self, text: str, confidence: float | None) -> None:
        if self.state.mode == ARMED:
            match = wake.detect(text, settings.WAKE_WORD, settings.WAKE_FUZZ)
            if not match.hit:
                bus.publish("heard", text=text, mode=ARMED, used=False)
                return
            if match.remainder:
                # "Merc, two samosas fifty rupees" — all one breath.
                bus.publish("wake", heard_as=match.token, text=match.remainder)
                self.handle_transcript(match.remainder, confidence, source="wake")
                return
            self._arm_command_window(f"heard '{match.token}'")
            return

        if self.state.mode == LISTENING:
            # The window may have opened on a partial ("merc"), in which case
            # the final result for that same utterance is still just the wake
            # word. Don't spend the window on it — keep waiting for the order.
            command = wake.strip_wake(text, settings.WAKE_WORD, settings.WAKE_FUZZ).strip()
            if not command:
                self.state.listening_until = time.time() + settings.COMMAND_WINDOW_SEC
                bus.publish("heard", text=text, mode=LISTENING, used=False)
                return

            self.handle_transcript(command, confidence, source="voice", strip_wake_word=False)
            if self.state.wake_enabled:
                self.state.mode = ARMED
                self.state.listening_until = 0.0
                bus.publish("state", **self.status())

    def _arm_command_window(self, reason: str) -> None:
        self.state.mode = LISTENING
        self.state.listening_until = time.time() + settings.COMMAND_WINDOW_SEC
        bus.publish("listening", reason=reason, seconds=settings.COMMAND_WINDOW_SEC)

    def _end_command_window(self) -> None:
        self.state.listening_until = 0.0
        if self.state.wake_enabled:
            self.state.mode = ARMED
            bus.publish("timeout", message=f"nothing heard — say '{settings.WAKE_WORD}' again")
        bus.publish("state", **self.status())


agent = VoiceAgent()


class StreamSession:
    """One remote microphone streaming PCM in — the phone app.

    Same wake-word and command-window logic as the local mic loop, but the
    audio arrives over a websocket instead of a sound card, and each connection
    gets its own recognizer and its own state. Events are returned to the
    caller rather than published globally; only the resulting transaction goes
    on the bus, so every other screen sees it too.
    """

    def __init__(self, owner: VoiceAgent | None = None, wake_enabled: bool = True) -> None:
        self.agent = owner or agent
        self.wake_enabled = wake_enabled
        self.recognizer = engine.new_recognizer(
            grammar.phrases_for(catalog.products, settings.WAKE_WORD)
        )
        self.mode = ARMED if wake_enabled else LISTENING
        self.listening_until = 0.0 if wake_enabled else time.time() + 3600
        self._events: list[dict] = []
        self._last_partial = ""
        # While the button is held, the recognizer's own sentence boundaries
        # are ignored and everything is collected until release.
        self._buffering = False
        self._pending: list[str] = []
        self._candidate: str | None = None
        self._confidence: float | None = None
        self._settle_at = 0.0

    # -- outgoing events -------------------------------------------------

    def _emit(self, type_: str, **payload) -> None:
        self._events.append({"type": type_, **payload})

    def _drain(self) -> list[dict]:
        out, self._events = self._events, []
        return out

    def state(self) -> dict:
        return {
            "type": "state",
            "mode": self.mode,
            "wake_enabled": self.wake_enabled,
            "wake_word": settings.WAKE_WORD,
        }

    # -- control ---------------------------------------------------------

    def listen_now(
        self, seconds: float | None = None, buffered: bool = False
    ) -> list[dict]:
        """Open a command window.

        `buffered` is push-to-talk: the merchant is holding the button, so
        nothing is committed until they let go. Without it a pause after
        "two" ends the sentence and files a two-rupee sale before "cold
        coffee" is even spoken.
        """
        self.mode = LISTENING
        self._buffering = buffered
        self._pending = []
        # Held buttons have no timeout; release ends the utterance. The long
        # ceiling is only there so a dropped connection can't listen forever.
        window = 120.0 if buffered else (seconds or settings.COMMAND_WINDOW_SEC)
        self.listening_until = time.time() + window
        self.recognizer.Reset()
        self._emit("listening", reason="button", seconds=window)
        self._events.append(self.state())
        return self._drain()

    def flush(self) -> list[dict]:
        """Finish the current utterance now — the button was released.

        Everything heard while the button was down is joined into one sentence
        and run through the extractor once.
        """
        tail, confidence = _parse_result(self.recognizer.FinalResult())
        self._last_partial = ""

        buffering, self._buffering = self._buffering, False
        self._candidate = None
        self._settle_at = 0.0
        parts = [*self._pending, tail] if buffering else [tail]
        self._pending = []
        text = " ".join(p for p in parts if p).strip()

        if text:
            if buffering:
                self._emit("heard", text=text, used=True)
                self._handle(text, confidence, "phone")
                if self.wake_enabled:
                    self.mode = ARMED
                    self.listening_until = 0.0
                    self._events.append(self.state())
            else:
                self._on_final(text, confidence)
        if self._candidate:
            self._commit()
        if not any(e["type"] == "result" for e in self._events):
            self._emit(
                "result",
                accepted=False,
                cancelled=False,
                reason="nothing heard" if not text else "not a sale",
                transcript=text,
                transaction=None,
            )
        return self._drain()

    def set_wake(self, enabled: bool) -> list[dict]:
        self.wake_enabled = enabled
        self.mode = ARMED if enabled else LISTENING
        self.listening_until = 0.0 if enabled else time.time() + 3600
        self._events.append(self.state())
        return self._drain()

    # -- audio in --------------------------------------------------------

    def feed(self, pcm: bytes) -> list[dict]:
        """Push 16-bit mono PCM at the configured sample rate."""
        if self.recognizer.AcceptWaveform(pcm):
            text, confidence = _parse_result(self.recognizer.Result())
            self._last_partial = ""
            if text:
                self._on_final(text, confidence)
        else:
            partial = parse_partial(self.recognizer.PartialResult())
            if partial and partial != self._last_partial:
                self._last_partial = partial
                self._emit("partial", text=partial, mode=self.mode)
                if self.mode == ARMED and wake.detect(
                    partial, settings.WAKE_WORD, settings.WAKE_FUZZ
                ).hit:
                    self._open_window("wake word")

        now = time.time()

        # Long enough since the order last made sense — take it.
        if self._settle_at and now >= self._settle_at:
            self._commit()

        elif self.mode == LISTENING and self.listening_until and now > self.listening_until:
            self.listening_until = 0.0
            if self._candidate:
                self._commit()  # ran out of time but we have something usable
            else:
                heard = " ".join(self._pending).strip()
                self._pending = []
                if self.wake_enabled:
                    self.mode = ARMED
                    self._emit(
                        "timeout",
                        message=heard
                        and f"“{heard}” isn't a sale — say '{settings.WAKE_WORD}' again"
                        or f"say '{settings.WAKE_WORD}' again",
                    )
                    self._events.append(self.state())

        return self._drain()

    def _on_final(self, text: str, confidence: float | None) -> None:
        if self._buffering:
            # A pause, not the end of the order. Keep it and wait for release.
            self._add_fragment(text)  
            self._emit("heard", text=" ".join(self._pending), used=True)
            return

        if self.mode == ARMED:
            match = wake.detect(text, settings.WAKE_WORD, settings.WAKE_FUZZ)
            if not match.hit:
                self._emit("heard", text=text, used=False)
                return
            if match.remainder:
                self._emit("wake", heard_as=match.token, text=match.remainder)
                self._handle(match.remainder, confidence, "phone-wake")
                return
            self._open_window(f"heard '{match.token}'")
            return

        # Hands-free. The recognizer ends a sentence at every pause, but
        # "seven… samosas" is one order. Keep the words, and only commit once
        # they add up to a sale.
        self._pending.append(text)
        self._confidence = confidence
        joined = " ".join(self._pending).strip()
        command = wake.strip_wake(joined, settings.WAKE_WORD, settings.WAKE_FUZZ).strip()

        if not command:
            # The wake utterance's own final result. Not the order.
            self.listening_until = time.time() + settings.COMMAND_WINDOW_SEC
            self._pending = []
            self._emit("heard", text=text, used=False)
            return

        self._emit("heard", text=command, used=True)
        result = self.agent.preview(command)
        now = time.time()

        if result.ok or result.cancel:
            self._candidate = command
            self._commit()
        else:
            # Not a sale yet — "seven" on its own. Wait for the rest.
            self._candidate = None
            self._settle_at = 0.0
            self.listening_until = now + settings.COMMAND_WINDOW_SEC

    def _add_fragment(self, text: str) -> None:
        """Add a fragment, dropping any overlap with what we already have.

        Recognizers re-emit the start of an utterance as it firms up, so
        "five" followed by "five cold" must become "five cold" and not
        "five five cold" — which reads as a five-rupee price for five items.
        """
        text = text.strip()
        if not text:
            return
        if not self._pending:
            self._pending.append(text)
            return

        joined = " ".join(self._pending)
        if text in joined:
            return
        if joined in text:
            self._pending = [text]
            return

        # Trim the longest overlap between the tail of what we have and the
        # head of what just arrived.
        have, new = joined.split(), text.split()
        for size in range(min(len(have), len(new)), 0, -1):
            if have[-size:] == new[:size]:
                remainder = " ".join(new[size:])
                if remainder:
                    self._pending.append(remainder)
                return
        self._pending.append(text)

    def _commit(self) -> None:
        """Take the order that is on the table and re-arm."""
        command, confidence = self._candidate, self._confidence
        self._candidate = None
        self._settle_at = 0.0
        self._pending = []
        self._confidence = None
        self.listening_until = 0.0

        if command:
            self._handle(command, confidence, "phone")
        if self.wake_enabled:
            self.mode = ARMED
            self._events.append(self.state())

    def _handle(self, text: str, confidence: float | None, source: str) -> None:
        result = self.agent.handle_transcript(
            text, confidence, source=source, strip_wake_word=False
        )
        self._emit(
            "result",
            accepted=result.ok,
            cancelled=result.cancel,
            reason=result.reason,
            transcript=text,
            transaction=result.transaction.model_dump(mode="json") if result.transaction else None,
        )

    def _open_window(self, reason: str) -> None:
        self._buffering = False
        self._candidate = None
        self._settle_at = 0.0
        self._pending = []
        self.mode = LISTENING
        self.listening_until = time.time() + settings.COMMAND_WINDOW_SEC
        self._emit("listening", reason=reason, seconds=settings.COMMAND_WINDOW_SEC)
        self._events.append(self.state())


def transaction_from_text(text: str, confidence: float | None = None) -> Transaction | None:
    """Convenience for scripts and tests."""
    return agent.handle_transcript(text, confidence, source="api").transaction


__all__ = [
    "VoiceAgent",
    "StreamSession",
    "agent",
    "transaction_from_text",
    "TransactionStatus",
]

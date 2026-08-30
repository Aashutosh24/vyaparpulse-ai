"""Offline speech-to-text on top of Vosk.

Nothing here touches the network. The model is a folder on disk; download it
once with scripts/download_model.py and the agent runs with the device in
airplane mode forever after.
"""

from __future__ import annotations

import io
import json
import logging
import wave
from array import array
from dataclasses import dataclass
from pathlib import Path

from ..config import settings
from .grammar import strip_unknown

log = logging.getLogger(__name__)

try:  # vosk is required to actually listen, but the API should still boot
    from vosk import KaldiRecognizer, Model, SetLogLevel

    SetLogLevel(-1)  # silence kaldi's chatter
    VOSK_IMPORT_ERROR: str | None = None
except Exception as exc:  # pragma: no cover - only on a broken install
    KaldiRecognizer = Model = None  # type: ignore[assignment]
    VOSK_IMPORT_ERROR = str(exc)


@dataclass
class Utterance:
    text: str
    confidence: float | None = None


class SpeechEngine:
    """Loads the Vosk model once and hands out recognizers."""

    def __init__(self, model_dir: Path | None = None, sample_rate: int | None = None) -> None:
        self.model_dir = Path(model_dir or settings.MODEL_DIR)
        self.sample_rate = sample_rate or settings.SAMPLE_RATE
        self._model = None
        self.error: str | None = VOSK_IMPORT_ERROR
        self.grammar_error: str | None = None

    # -- lifecycle -------------------------------------------------------

    def load(self) -> bool:
        if self._model is not None:
            return True
        if Model is None:
            self.error = f"vosk is not installed: {VOSK_IMPORT_ERROR}"
            return False
        if not self.model_dir.exists():
            self.error = (
                f"no speech model at {self.model_dir}. "
                "Run: python scripts/download_model.py"
            )
            return False
        try:
            log.info("loading vosk model from %s", self.model_dir)
            self._model = Model(str(self.model_dir))
            self.error = None
            return True
        except Exception as exc:  # pragma: no cover - depends on model files
            self.error = f"could not load model: {exc}"
            return False

    @property
    def ready(self) -> bool:
        return self._model is not None

    def status(self) -> dict:
        return {
            "ready": self.ready,
            "model_dir": str(self.model_dir),
            "model_present": self.model_dir.exists(),
            "sample_rate": self.sample_rate,
            "grammar": settings.STT_GRAMMAR and self.grammar_error is None,
            "grammar_error": self.grammar_error,
            "error": self.error,
        }

    def new_recognizer(self, phrases: list[str] | None = None):
        """A recognizer, restricted to `phrases` when the model supports it.

        Big models are static and reject a word list; rather than refuse to
        run, fall back to open transcription and say so in /health.
        """
        if not self.load():
            raise RuntimeError(self.error or "speech model unavailable")

        if phrases and settings.STT_GRAMMAR:
            try:
                rec = KaldiRecognizer(self._model, self.sample_rate, json.dumps(phrases))
                rec.SetWords(True)
                self.grammar_error = None
                return rec
            except Exception as exc:
                self.grammar_error = (
                    f"this model does not support a restricted vocabulary ({exc}); "
                    "transcribing everything instead. Small models support it."
                )
                log.warning("%s", self.grammar_error)

        rec = KaldiRecognizer(self._model, self.sample_rate)
        rec.SetWords(True)
        return rec

    # -- one-shot transcription -----------------------------------------

    def transcribe_wav(self, data: bytes, phrases: list[str] | None = None) -> Utterance:
        """Transcribe a WAV clip — how the browser button sends audio."""
        pcm, rate = _wav_to_pcm16_mono(data)
        if rate != self.sample_rate:
            pcm = _resample_pcm16(pcm, rate, self.sample_rate)

        rec = self.new_recognizer(phrases)
        texts: list[str] = []
        confs: list[float] = []

        step = self.sample_rate * 2  # ~1s of 16-bit mono audio
        for i in range(0, len(pcm), step):
            if rec.AcceptWaveform(pcm[i : i + step]):
                text, conf = _parse_result(rec.Result())
                if text:
                    texts.append(text)
                    if conf is not None:
                        confs.append(conf)

        text, conf = _parse_result(rec.FinalResult())
        if text:
            texts.append(text)
            if conf is not None:
                confs.append(conf)

        return Utterance(
            " ".join(texts).strip(),
            round(sum(confs) / len(confs), 3) if confs else None,
        )


# -- helpers -------------------------------------------------------------


def _parse_result(raw: str) -> tuple[str, float | None]:
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError):
        return "", None
    text = strip_unknown(payload.get("text") or "")
    words = payload.get("result") or []
    confs = [w.get("conf") for w in words if isinstance(w.get("conf"), (int, float))]
    conf = round(sum(confs) / len(confs), 3) if confs else None
    return text, conf


def parse_partial(raw: str) -> str:
    try:
        return strip_unknown(json.loads(raw).get("partial") or "")
    except (TypeError, ValueError):
        return ""


def _wav_to_pcm16_mono(data: bytes) -> tuple[bytes, int]:
    """Accept any sane WAV and return 16-bit mono PCM."""
    with wave.open(io.BytesIO(data), "rb") as wf:
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        rate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())

    if width != 2:
        raise ValueError(f"expected 16-bit PCM WAV, got {width * 8}-bit")
    if channels > 1:
        frames = _downmix(frames, channels)
    return frames, rate


def _numpy():
    """numpy if it's installed — it isn't required, just faster."""
    try:
        import numpy as np

        return np
    except ImportError:
        return None


def _downmix(pcm: bytes, channels: int) -> bytes:
    """Interleaved multi-channel 16-bit PCM -> mono."""
    np = _numpy()
    if np is not None:
        samples = np.frombuffer(pcm, dtype=np.int16)
        usable = len(samples) - (len(samples) % channels)
        mono = samples[:usable].reshape(-1, channels).mean(axis=1)
        return mono.astype(np.int16).tobytes()

    samples = array("h")
    samples.frombytes(pcm[: len(pcm) - len(pcm) % (2 * channels)])
    mono = array("h", (sum(samples[i : i + channels]) // channels for i in range(0, len(samples), channels)))
    return mono.tobytes()


def _resample_pcm16(pcm: bytes, src_rate: int, dst_rate: int) -> bytes:
    """Linear resample. Browsers record at 44.1/48 kHz; Vosk wants 16 kHz."""
    if src_rate == dst_rate or not pcm:
        return pcm

    np = _numpy()
    if np is not None:
        samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32)
        out_len = max(1, int(len(samples) * dst_rate / src_rate))
        positions = np.linspace(0, len(samples) - 1, out_len)
        return np.interp(positions, np.arange(len(samples)), samples).astype(np.int16).tobytes()

    samples = array("h")
    samples.frombytes(pcm)
    if not samples:
        return pcm
    out_len = max(1, int(len(samples) * dst_rate / src_rate))
    step = (len(samples) - 1) / max(1, out_len - 1) if out_len > 1 else 0
    out = array("h")
    for i in range(out_len):
        pos = i * step
        left = int(pos)
        right = min(left + 1, len(samples) - 1)
        frac = pos - left
        out.append(int(samples[left] + (samples[right] - samples[left]) * frac))
    return out.tobytes()


engine = SpeechEngine()

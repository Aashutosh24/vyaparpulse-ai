"""Runtime settings for the offline voice agent.

Everything is overridable with environment variables so the same code runs on a
dev laptop and on the merchant's device without edits.
"""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


def _env_path(name: str, default: Path) -> Path:
    raw = os.getenv(name)
    return Path(raw).expanduser().resolve() if raw else default


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


class Settings:
    # --- speech ---------------------------------------------------------
    # Folder of an unpacked Vosk model. Run scripts/download_model.py to get one.
    MODEL_DIR: Path = _env_path("VOSK_MODEL_PATH", BASE_DIR / "models" / "vosk-model-small-en-in-0.4")
    SAMPLE_RATE: int = int(os.getenv("VOSK_SAMPLE_RATE", "16000"))
    # sounddevice input device index; None = system default
    INPUT_DEVICE: int | None = (
        int(os.environ["VOICE_INPUT_DEVICE"]) if os.getenv("VOICE_INPUT_DEVICE") else None
    )

    # Restrict the recognizer to the words a sale can contain. Huge accuracy
    # win on small models; set to 0 to let it transcribe anything.
    STT_GRAMMAR: bool = os.getenv("STT_GRAMMAR", "0") == "1"

    # --- wake word ------------------------------------------------------
    WAKE_WORD: str = os.getenv("WAKE_WORD", "merc")
    # Small STT models rarely have "merc" in their vocabulary, so near-misses
    # count too. Tune with WAKE_FUZZ (1.0 = exact match only).
    WAKE_FUZZ: float = _env_float("WAKE_FUZZ", 0.78)
    # Seconds to keep capturing a command after the wake word fires.
    COMMAND_WINDOW_SEC: float = _env_float("COMMAND_WINDOW_SEC", 15.0)
    COMMAND_SETTLE_SEC: float = _env_float("COMMAND_SETTLE_SEC", 1.6)
    ALLOW_UNKNOWN_ITEMS: bool = os.getenv("ALLOW_UNKNOWN_ITEMS", "1") == "1"

    # A counter sale that reads as a lakh is a misheard sentence, not a sale.
    MAX_AMOUNT: float = _env_float("MAX_AMOUNT", 100_000)

    # Vosk reports per-word confidence. Below this, treat the transcript as
    # noise rather than filing whatever it happened to say.
    MIN_CONFIDENCE: float = _env_float("MIN_CONFIDENCE", 0.55)
    # --- data -----------------------------------------------------------
    DATA_DIR: Path = _env_path("DATA_DIR", BASE_DIR / "data")
    PRODUCTS_FILE: Path = _env_path("PRODUCTS_FILE", BASE_DIR / "data" / "products.json")

    # Minutes after which an unpaid transaction is flagged for the merchant.
    PENDING_ALERT_MIN: float = _env_float("PENDING_ALERT_MIN", 7.0)


settings = Settings()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)

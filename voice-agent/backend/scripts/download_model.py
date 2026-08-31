"""Download and unpack a Vosk speech model.

Run once, with internet. After that the agent works offline forever.

    python scripts/download_model.py                   # Indian English (recommended)
    python scripts/download_model.py en-us-lgraph      # bigger, still constrainable
    python scripts/download_model.py hi                # Hindi
    python scripts/download_model.py --list
"""

from __future__ import annotations

import argparse
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

BASE = "https://alphacephei.com/vosk/models"
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

# Only *small* models support a restricted vocabulary, which is where most of
# this app's accuracy comes from. The big models are more accurate on open
# speech but cannot be constrained, so for a shop counter they usually score
# worse. Pick a big one only if you have turned STT_GRAMMAR off.
MODELS = {
    "en-in": ("vosk-model-small-en-in-0.4", "Indian English, ~40 MB — the default, supports grammar"),
    "en-us": ("vosk-model-small-en-us-0.15", "US English, ~40 MB — supports grammar"),
    "en-us-lgraph": ("vosk-model-en-us-0.22-lgraph", "US English, ~128 MB — better, still supports grammar"),
    "hi": ("vosk-model-small-hi-0.22", "Hindi, ~42 MB — supports grammar"),
    "en-in-big": ("vosk-model-en-in-0.5", "Indian English, ~1 GB — no grammar, needs ~2 GB RAM"),
    "en-us-big": ("vosk-model-en-us-0.22", "US English, ~1.8 GB — no grammar, needs ~4 GB RAM"),
}


def download(key: str) -> Path:
    if key not in MODELS:
        sys.exit(f"unknown model {key!r}. Options: {', '.join(MODELS)}")

    name, _ = MODELS[key]
    target = MODELS_DIR / name
    if target.exists():
        print(f"already there: {target}")
        return target

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    url = f"{BASE}/{name}.zip"
    archive = MODELS_DIR / f"{name}.zip"

    print(f"downloading {url}")
    with urllib.request.urlopen(url) as response, archive.open("wb") as out:
        total = int(response.headers.get("Content-Length") or 0)
        done = 0
        while chunk := response.read(1 << 16):
            out.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r  {done * 100 // total}%  ({done >> 20} MB)", end="", flush=True)
    print("\nunpacking")

    with zipfile.ZipFile(archive) as zf:
        zf.extractall(MODELS_DIR)
    archive.unlink()

    # Some archives nest the model one level deeper than their own name.
    if not (target / "am").exists() and not (target / "conf").exists():
        for candidate in MODELS_DIR.rglob("conf"):
            root = candidate.parent
            if root != target:
                shutil.move(str(root), str(target))
            break

    print(f"ready: {target}")
    print(f"set VOSK_MODEL_PATH={target} in backend/.env to use it.")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", nargs="?", default="en-in", help="en-in | en-us | hi")
    parser.add_argument("--list", action="store_true", help="show available models")
    args = parser.parse_args()

    if args.list:
        for key, (name, note) in MODELS.items():
            print(f"  {key:6} {name:30} {note}")
        return

    download(args.model)


if __name__ == "__main__":
    main()

# Smart Merchant Payment App — Voice Agent

Offline voice logging for a shop counter. The merchant says
**"Merc, two samosas for fifty rupees"** and a structured `PENDING` transaction
lands in the day's list, ready for the payment-matching module to settle.

```
smart_merchant_voice_agent/
├── backend/            Python. Speech, wake word, extraction, storage, API.
├── app/                Flutter. Microphone and screen.
├── start_backend.sh    setup + run (macOS / Linux)
└── start_backend.bat   setup + run (Windows)
```

## Which half does what

The phone does **not** run a speech model. It streams raw microphone audio to
the backend, which owns the model, the wake word and the extractor. One
implementation of that logic, one place to fix a bug, and the phone stays
light. Nothing leaves your network — the backend runs on your own machine and
the speech model is a folder on disk.

```
Flutter app ──PCM16 audio──▶ ws://backend/ws/audio
            ◀──partial / wake / listening / result──
            ──REST──▶ /api/transactions, /api/summary, /api/voice/text

Browser console (bundled with the backend) uses the same API.
```

## Run it

**1. Backend** — on your laptop or the shop's PC:

```bash
./start_backend.sh          # Windows: double-click start_backend.bat
```

That creates a venv, installs dependencies, downloads the ~40 MB speech model
once, and serves on port 8000. Open http://127.0.0.1:8000 to use it straight
from a browser — no phone needed.

**2. App** — with the backend running:

```bash
cd app
flutter pub get
flutter run
```

Tap the gear icon and set the backend address:

- Android emulator → `10.0.2.2:8000` (already the default)
- Real phone → your computer's LAN address, e.g. `192.168.1.7:8000`
  (`ipconfig` on Windows, `ifconfig` on Mac/Linux). Same Wi-Fi, both devices.

### Windows: enable Developer Mode first

`flutter run` needs symlink support. If pub get told you to enable Developer
Mode, run `start ms-settings:developers`, switch it on, then reopen the
terminal. Nothing about the project is wrong — Windows blocks symlinks for
non-admin users by default.

## Using it

| How | What happens |
|---|---|
| **Hold the mic button**, speak, release | Nothing is saved until you let go, so pausing mid-order is fine. This is the default. |
| Turn on **Hands free**, then say "Merc, two samosas fifty rupees" | The mic stays open listening for the wake word until you switch it off |
| Type into the box | Same extractor, no microphone — best for testing |

The microphone is shut until you ask for it. Hands-free mode holds it open on
purpose, which is why it is an explicit switch and not the default.

Say **"each"** or put the price first when you quote a per-piece rate:
"ten rupees five samosa" bills ₹50.

Say **"each"** when you quote a per-piece price: "two samosas each fifty
rupees" bills ₹100, while "two samosas for fifty rupees" bills ₹50. The list
shows the rate it used — `Samosa ×2 @ ₹50`.

A sale becomes `PENDING` immediately. It flips to `PAID` when the
payment-matching module posts a matching credit, or when you tap the tag.
Anything still pending after 7 minutes is flagged overdue.

### The wake word is heard as "mark"

A 40 MB speech model has no "merc" in its vocabulary, so it writes the closest
word it knows — *mark*, *march*, *merck*, *murk*. The backend treats all of
those as a hit plus a fuzzy match for anything else merc-shaped, which is why
it works on a real device. Ordinary shop talk doesn't trip it. Tune with
`WAKE_FUZZ` in `backend/.env`.

## The hand-off to payment matching

The voice agent never decides whether a customer paid. The other module posts
what it read from the SMS or UPI notification:

```json
POST /api/payments/match
{ "amount": 50, "timestamp": "2026-08-29T10:18:00Z", "direction": "CREDIT" }
```

The oldest pending sale with that amount inside the window flips to `PAID`.
Full API in `backend/README.md`.

## Accuracy comes from the catalog

Edit `backend/data/products.json`. This is the highest-leverage file in the
project: the recognizer is restricted to the words your catalog implies, so a
product you list is a product it can hear. Add the spellings the model actually
produces to each `aliases` list ("somosa", "chai", "called coffee") and those
enter the vocabulary too.

A 40 MB model picking from 128 shop words beats a 1 GB model picking from
200,000. Details and model choices in `backend/README.md`.

## Tests

```bash
cd backend && python -m pytest -q     # 50 tests, no mic or model needed
cd app && flutter test
```

The backend suite covers number parsing, every extraction rule, the wake word
including mishearings, both microphone state machines driven with a scripted
recognizer, and WAV conversion.

## Known gaps

- The Flutter code is written against `record` 6.x and `web_socket_channel`
  3.x but hasn't been compiled here — run `flutter pub get` and `flutter analyze`
  first; any fix will be a package version, not the logic.
- Regional language support means swapping the Vosk model
  (`python scripts/download_model.py hi`) and adding number words to
  `backend/app/voice/numbers.py`. The Hindi numerals are already there.
- The backend is plain HTTP for the LAN. Put it behind TLS before it leaves
  the shop's network.

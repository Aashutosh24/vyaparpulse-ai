# Merchant Voice Agent — Flutter app

The shop-counter screen. The phone is a microphone and a display: speech
recognition, the "Merc" wake word and transaction extraction all live in the
backend, so that logic has one implementation instead of two that drift apart.

```
mic (record, PCM16 @16kHz)
  --> ws://<backend>/ws/audio        raw audio out
  <-- partial / wake / listening / result / state   events back
REST /api/transactions, /api/summary, /api/voice/text for the rest
```

The microphone is shut until asked for. The first press opens it and it then
stays open but idle: audio only leaves the device while the button is down.
Reconnecting on every press is what swallowed the leading count, and a rolling
half-second pre-roll covers the merchant who starts talking a moment early.
"MIC OFF" closes it for real.

Press sends `{"action":"listen","buffered":true}`, release sends
`{"action":"flush"}` — so a pause mid-order can't split one sale into two.

## Run

```bash
flutter pub get
flutter run
```

Start the backend first (see `../backend/README.md`), then set its address in
the app: tap the gear icon.

- Android emulator: `10.0.2.2:8000` (the default)
- Real phone: your computer's LAN address, e.g. `192.168.1.7:8000`.
  Find it with `ipconfig` (Windows) or `ifconfig | grep inet` (Mac/Linux).
  Phone and computer must be on the same Wi-Fi.

## Files

| Path | What it does |
|---|---|
| `lib/config.dart` | backend address, remembered between launches |
| `lib/models/` | `Transaction` and `Product`, mirroring the Python schema |
| `lib/services/api_client.dart` | REST calls |
| `lib/services/voice_client.dart` | mic -> websocket, events back |
| `lib/ui/home_page.dart` | mic button, live transcript, totals, list |
| `lib/ui/settings_sheet.dart` | backend address + connection test |

## What changed from the old app

The previous version ran Vosk on the device via `vosk_flutter_service`, kept a
second copy of the extractor in Dart, and stored rows in SQLite — while the
backend did nothing but echo. Three problems with that:

- the Dart extractor's number words stopped at *twenty*, so "fifty rupees"
  produced no number and the sale was silently dropped;
- the sync service posted to `127.0.0.1:8000`, which on a phone is the phone
  itself, so nothing ever reached the backend;
- `vosk_flutter_service`'s API was guessed, as the old README admitted.

Now there is one pipeline, on the server, that both this app and the browser
console use. `vosk_flutter_service`, `sqflite`, `archive` and `connectivity_plus`
are gone from `pubspec.yaml`.

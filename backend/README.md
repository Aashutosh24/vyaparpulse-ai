# Offline Voice Agent — Backend

Speech in, structured `PENDING` transactions out. Fully offline: the speech
model is a folder on disk, nothing leaves the device.

```
"Merc, two samosas for fifty rupees"
   -> Vosk offline STT        (app/voice/stt.py)
   -> wake word "Merc"        (app/voice/wake.py)
   -> extraction              (app/voice/extractor.py + numbers.py)
   -> Transaction, PENDING    (app/models/transaction.py)
   -> store + daily JSONL     (app/store.py)
   -> live to the console/app (WebSocket /ws)
```

## Quickstart

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate

pip install -r requirements.txt
python scripts/download_model.py   # ~40 MB, one time, needs internet
python run.py
```

Open **http://127.0.0.1:8000** for the merchant console, or `/docs` for the API.

## Three ways to add a sale

| How | What happens |
|---|---|
| Say **"Merc, two samosas fifty rupees"** | Wake word fires and the whole sentence is captured in one breath |
| Say **"Merc"**, wait, then speak | Wake word opens an 8-second command window |
| **Hold the button** in the console | Records in the browser, transcribes on the server — no wake word needed |

Typing into the console's text box runs the same extractor, which is the
fastest way to test rules without a mic.

### About the wake word

A 40 MB speech model does not have "merc" in its vocabulary, so it transcribes
the nearest word it knows — *mark*, *march*, *merck*, *murk*. `wake.py` treats
all of those as a hit, plus a fuzzy match for anything else merc-shaped.
Ordinary shop talk ("two samosas for fifty rupees") does not trigger it.

Tune with `WAKE_FUZZ`: raise it toward `1.0` if it fires on its own, lower it
toward `0.7` if it ignores you. To change the word entirely, set `WAKE_WORD`
and add the spellings the model actually produces to `HOMOPHONES` in
`app/voice/wake.py`.

## What the extractor does

| Said | item | qty | amount | unit_price |
|---|---|---|---|---|
| two samosas for fifty rupees | Samosa | 2 | 50 | — |
| two samosas each fifty rupees | Samosa | 2 | **100** | 50 |
| ten rupees five samosa | Samosa | 5 | **50** | 10 |
| ten rupees teas for twelve | Tea | 12 | **120** | 10 |
| five rupees eighteen chocolate | Chocolate | 18 | **90** | 5 ← not in the catalog |
| tea 20 rupees | Tea | 1 | 20 | — |
| 100 rupees | `null` | `null` | 100 | — |
| two teas | Tea | 2 | 20 | 10 ← priced from the catalog |
| three coffee sixty | Coffee | 3 | 60 | — ← no currency word needed |
| chai das rupees | Tea | 1 | 10 | — ← aliases + Hindi numerals |
| cancel / undo | — | — | deletes the last pending sale | |

Finding the money, in order: the number next to a currency word; otherwise the
number after "for"; otherwise, with an item, the number *after* the item name.
No number and no item means nothing is stored — the utterance is reported as
ignored, never guessed at.

**Rate or total?** `amount` is always the bill. Which one was spoken is decided
in this order:

1. a per-unit word — each, apiece, per, ek ka, har ek — makes it a **rate**;
2. "for" leading into the number makes it a **total** ("for fifty rupees");
3. a price spoken *before* the goods is a **rate** ("ten rupees five samosa"),
   because a total lands at the end of a sentence and never in front of what
   was bought;
4. otherwise it is the total.

When a rate was used, `unit_price` records it and the list shows
"Samosa ×5 @ ₹10". A quantity that isn't a small whole number never multiplies,
so a misheard year can't produce a 2000× bill.

**Items you never listed.** If nothing in the catalog matches but a count is
followed by a plain word — "five rupees eighteen chocolate" — that word becomes
the item: Chocolate ×18 = ₹90. A guessed item carries no price, so "two
chocolates" with no amount spoken is rejected rather than sold for nothing.
Add real products to `data/products.json` anyway; the catalog also supplies
prices and aliases.

One thing to know: "two fifty" parses as 2 and 50, not 250, because
"two samosas fifty rupees" is the far more common sentence. Say
"two hundred fifty" for 250.

Edit `data/products.json` (or `PUT /api/products`) to match the real shop. Add
whatever the model mishears into `aliases` — that's what fixes accuracy fastest.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | model + agent state |
| `GET` | `/api/status` | agent, summary, products, recent events |
| `POST` | `/api/voice/listen` | **the activate button** — capture one command |
| `POST` | `/api/voice/start` / `/stop` | server microphone on/off |
| `POST` | `/api/voice/wake` | `{"enabled": true\|false}` |
| `POST` | `/api/voice/audio` | upload a WAV clip, get a transaction back |
| `POST` | `/api/voice/text` | `{"text": "..."}` — same pipeline, typed |
| `GET` | `/api/transactions` | `?date=YYYY-MM-DD\|all&status=PENDING` |
| `POST` | `/api/transactions` | ingest one built elsewhere (Flutter sync) |
| `PATCH` | `/api/transactions/{id}/status` | `{"status": "PAID"}` |
| `DELETE` | `/api/transactions/{id}` | remove a mistake |
| `GET` | `/api/summary` | day totals: count, total, paid, pending, overdue |
| `POST` | `/api/payments/match` | payment module hand-off, flips PENDING → PAID |
| `GET`/`PUT` | `/api/products` | the merchant's catalog |
| `WS` | `/ws` | live events: `partial`, `wake`, `listening`, `transaction`, `status` |

### The contract with the payment-matching module

The voice agent never decides whether a customer paid. It only writes
`PENDING`. The other module posts what it read from the SMS/UPI notification:

```json
POST /api/payments/match
{ "amount": 50, "timestamp": "2026-08-29T10:18:00Z", "direction": "CREDIT" }
```

The oldest pending transaction with that amount inside the window (default 10
minutes) flips to `PAID`. Anything still pending after `PENDING_ALERT_MIN`
shows up in `GET /api/summary` as `overdue_ids` — that's the notification hook.

### Transaction JSON

Identical to `flutter/lib/models/transaction.dart`, so either side can produce it:

```json
{
  "id": "4eeecb175c2b",
  "item": "Samosa",
  "quantity": 2,
  "amount": 50.0,
  "timestamp": "2026-08-29T09:12:41.883Z",
  "status": "PENDING",
  "raw_text": "two samosas for fifty rupees",
  "confidence": 0.94
}
```

## Storage

One JSON-lines file per day in `data/` (`transactions-2026-08-29.jsonl`) — the
history the spec wants for later business/ML analysis, and one line of pandas
to load. Today's file is restored on startup, so a restart mid-shift loses
nothing. Swap `TransactionStore` for SQLite when that stops being enough.

## Configuration

Copy `.env.example` and set what you need, or export the variables directly.
`WAKE_WORD`, `WAKE_FUZZ`, `COMMAND_WINDOW_SEC`, `VOSK_MODEL_PATH`,
`VOICE_INPUT_DEVICE`, `VOICE_AUTOSTART`, `PENDING_ALERT_MIN`.

## Tests

```bash
python -m pytest -q     # 43 tests, no mic or model needed
```

They cover number parsing, every extraction rule, the wake word (including
mishearings), the mic state machine driven directly, and the WAV conversion path.

## The button defines the sentence, not the silence

A recognizer ends a sentence at a pause. A merchant pauses in the middle of an
order — "two… cold coffee" — so the naive reading files a ₹2 sale before the
item is even spoken, then a second row for the rest.

So push-to-talk sends `{"action": "listen", "buffered": true}`. While the
button is held, every result the recognizer produces is collected rather than
acted on; `{"action": "flush"}` on release joins them into one sentence and
runs the extractor once. Hands-free mode has no button, so there a pause still
ends the order — that's the only place it can.

A related guard: a number on its own, with no product and no "rupees", is a
fragment and is refused. "100 rupees" still works, "two" does not.

## Accuracy: the vocabulary matters more than the model

A general model chooses each word from ~200,000 candidates and picks whatever
sounds closest, which is how "five cold coffees" becomes "why cold coffees" and
"for 700 rupees" becomes "there were rendered".

A shop counter uses about 128 words. `app/voice/grammar.py` builds that list
from your catalog — product names and aliases, number words, "rupees", "each",
the wake word and its mishearings — and hands it to the recognizer, which can
then only emit those words. "why" isn't an option, so "five" wins. Off-list
speech comes back as `[unk]` and is discarded, so background chatter stops
turning into orders.

This is on by default. `GET /health` shows `speech.grammar: true` when it's
active. Set `STT_GRAMMAR=0` to transcribe open speech instead.

**It follows that adding products improves recognition**, not just naming. Put
what the model actually produces into `aliases` and those spellings enter the
vocabulary too.

A second layer catches misheard counts that survive: "why/too/tan/tree" become
five/two/ten/three, but only when a product word follows, so "for 700 rupees"
keeps its "for".

### Choosing a model

| `download_model.py` | Size | Grammar | When |
|---|---|---|---|
| `en-in` (default) | 40 MB | yes | Indian English. Start here. |
| `en-us-lgraph` | 128 MB | yes | Better acoustics, still constrainable |
| `hi` | 42 MB | yes | Hindi |
| `en-in-big` | 1 GB | **no** | Open dictation, ~2 GB RAM |
| `en-us-big` | 1.8 GB | **no** | Open dictation, ~4 GB RAM |

Only small models support a restricted vocabulary; the big ones are static. For
a shop counter a big model usually scores *worse* than a small one with a
grammar, so try `en-us-lgraph` before reaching for a gigabyte. To switch:

```bash
python scripts/download_model.py en-us-lgraph
# then in backend/.env:
VOSK_MODEL_PATH=models/vosk-model-en-us-0.22-lgraph
```

If you do use a big model the recognizer refuses the word list, logs why, and
falls back to open transcription — `/health` reports it in `grammar_error`.

## Troubleshooting

**"no speech model at ..."** — run `python scripts/download_model.py`, or point
`VOSK_MODEL_PATH` at a model you already have.

**"microphone unavailable"** — `sounddevice` isn't installed, and it doesn't
need to be. It only lets the *backend machine* use its own mic; the phone and
the browser both send audio over the network instead. If you do want the
server mic: `pip install sounddevice`, on Python 3.11–3.12 where a wheel
exists.

**`python` opens the Microsoft Store (Windows)** — use `py -3.12` instead of
`python`, or install Python from python.org and tick "Add to PATH".

**Wake word never fires** — watch the console's transcript ribbon while you
speak and see what the model heard. Add that spelling to `HOMOPHONES`, or lower
`WAKE_FUZZ`. In a loud shop, use the button instead.

**Wrong item recognised** — add the misheard spelling to that product's
`aliases` in `data/products.json`. This fixes more than any model change will.

**Numbers come out wrong** — check `raw_text` on the stored transaction. It
keeps exactly what was heard, which usually shows the model, not the extractor,
was at fault.

## What was fixed from the original code

- The Python backend was an echo endpoint with no voice pipeline at all; all
  the logic lived in Dart. It now runs the full pipeline itself.
- The Dart extractor's number words stopped at *twenty*, so real speech like
  "fifty rupees" produced no number and the transaction was silently dropped.
  The Python parser handles words, digits, hundreds, thousands and lakhs.
- Quantity was picked as "the first number that isn't the amount", ignoring
  word order — wrong whenever quantity and amount are equal ("twenty teas
  twenty rupees"). Position decides it now.
- No wake word existed anywhere in the project.
- Nothing was persisted; totals and daily history had nowhere to come from.
- `requirements.txt` listed none of the speech dependencies.
- The zip carried `venv/`, `build/` and `__pycache__/`. A `.gitignore` is
  included — those shouldn't be committed.

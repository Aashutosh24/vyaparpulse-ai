"""Run with: python -m pytest -q   (from the backend/ folder)

No microphone and no speech model needed — these cover the text pipeline,
which is where all the extraction logic lives.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.models.product import Product  # noqa: E402
from app.voice import wake  # noqa: E402
from app.voice.extractor import TransactionExtractor  # noqa: E402
from app.voice.numbers import find_numbers  # noqa: E402

PRODUCTS = [
    Product(name="Samosa", price=25, aliases=["samosas"]),
    Product(name="Cold Coffee", price=40, aliases=["cold coffees"]),
    Product(name="Tea", price=10, aliases=["chai"]),
    Product(name="Coffee", price=20),
    Product(name="Masala Tea", price=15),
]


@pytest.fixture
def extractor() -> TransactionExtractor:
    return TransactionExtractor(PRODUCTS)


# -- numbers -------------------------------------------------------------


@pytest.mark.parametrize(
    "text,expected",
    [
        ("fifty", [50]),
        ("twenty five", [25]),
        ("one hundred", [100]),
        ("two hundred fifty", [250]),
        ("one hundred and twenty", [120]),
        ("one thousand five hundred", [1500]),
        ("two fifty", [2, 50]),          # documented split
        ("two samosas fifty rupees", [2, 50]),
        ("50 rupees", [50]),
        ("no numbers here", []),
    ],
)
def test_number_parsing(text, expected):
    assert [n.value for n in find_numbers(text)] == [float(v) for v in expected]


# -- extraction ----------------------------------------------------------


def test_spec_example_two_samosas(extractor):
    txn = extractor.extract("Two samosas for 50 rupees.").transaction
    assert (txn.item, txn.quantity, txn.amount, txn.status.value) == ("Samosa", 2, 50.0, "PENDING")


def test_spec_example_tea(extractor):
    txn = extractor.extract("Tea 20 rupees.").transaction
    assert (txn.item, txn.quantity, txn.amount) == ("Tea", 1, 20.0)


def test_spec_example_amount_only(extractor):
    txn = extractor.extract("100 rupees").transaction
    assert txn.item is None and txn.quantity is None and txn.amount == 100.0


def test_word_numbers_from_stt(extractor):
    txn = extractor.extract("two samosas for fifty rupees").transaction
    assert (txn.item, txn.quantity, txn.amount) == ("Samosa", 2, 50.0)


def test_prices_from_catalog_when_no_amount_spoken(extractor):
    txn = extractor.extract("two teas").transaction
    assert (txn.item, txn.quantity, txn.amount) == ("Tea", 2, 20.0)


def test_alias_match(extractor):
    txn = extractor.extract("chai ten rupees").transaction
    assert txn.item == "Tea" and txn.amount == 10.0


def test_longest_product_name_wins(extractor):
    txn = extractor.extract("masala tea fifteen rupees").transaction
    assert txn.item == "Masala Tea"


def test_missing_currency_word(extractor):
    txn = extractor.extract("three coffee sixty").transaction
    assert (txn.item, txn.quantity, txn.amount) == ("Coffee", 3, 60.0)


def test_no_amount_no_item_is_rejected(extractor):
    result = extractor.extract("hello there")
    assert not result.ok and result.reason == "no amount heard"


def test_cancel_command(extractor):
    result = extractor.extract("cancel that")
    assert result.cancel and result.transaction is None


def test_raw_text_and_confidence_preserved(extractor):
    txn = extractor.extract("Tea 20 rupees", confidence=0.87).transaction
    assert txn.raw_text == "Tea 20 rupees" and txn.confidence == 0.87


def test_json_contract_matches_flutter_side(extractor):
    payload = extractor.extract("two samosas for 50 rupees").transaction.model_dump(mode="json")
    assert set(payload) == {
        "id", "item", "quantity", "amount", "unit_price", "timestamp", "status",
        "raw_text", "confidence",
    }
    assert payload["status"] == "PENDING"


# -- wake word -----------------------------------------------------------


@pytest.mark.parametrize("heard", ["merc", "mark", "march", "merck", "murk", "merc."])
def test_wake_word_survives_mishearing(heard):
    assert wake.detect(f"{heard} tea ten rupees").hit


def test_wake_returns_the_command(_=None):
    match = wake.detect("merc two samosas fifty rupees")
    assert match.hit and match.remainder == "two samosas fifty rupees"


def test_plain_speech_does_not_wake():
    assert not wake.detect("two samosas for fifty rupees").hit
    assert not wake.detect("customer wants a coffee").hit


def test_last_wake_word_wins_on_stutter():
    assert wake.detect("merc merc tea ten rupees").remainder == "tea ten rupees"


def test_strip_wake_leaves_plain_text_alone():
    assert wake.strip_wake("tea ten rupees") == "tea ten rupees"


# -- audio helpers (the WAV path, minus the model) ------------------------


def _wav(rate: int, channels: int, seconds: float = 0.2) -> bytes:
    import io
    import math
    import struct
    import wave as wavelib

    frames = int(rate * seconds)
    buf = io.BytesIO()
    with wavelib.open(buf, "wb") as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(
            b"".join(
                struct.pack("<h", int(8000 * math.sin(i / 12))) * channels for i in range(frames)
            )
        )
    return buf.getvalue()


@pytest.mark.parametrize("rate,channels", [(16000, 1), (44100, 1), (48000, 2), (8000, 1)])
def test_wav_is_converted_to_16k_mono(rate, channels):
    from app.voice.stt import _resample_pcm16, _wav_to_pcm16_mono

    pcm, got_rate = _wav_to_pcm16_mono(_wav(rate, channels))
    assert got_rate == rate
    assert len(pcm) == int(rate * 0.2) * 2  # mono 16-bit

    out = _resample_pcm16(pcm, rate, 16000)
    assert abs(len(out) // 2 - int(16000 * 0.2)) <= 2


def test_eight_bit_wav_is_rejected_clearly():
    import io
    import wave as wavelib

    from app.voice.stt import _wav_to_pcm16_mono

    buf = io.BytesIO()
    with wavelib.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(1)
        w.setframerate(16000)
        w.writeframes(b"\x80" * 100)
    with pytest.raises(ValueError, match="16-bit"):
        _wav_to_pcm16_mono(buf.getvalue())


# -- the mic state machine (driven directly, no microphone needed) --------


@pytest.fixture
def fresh_agent(tmp_path, monkeypatch):
    """A VoiceAgent whose transcripts land in a throwaway data dir."""
    from app import store as store_module
    from app.voice import agent as agent_module

    test_store = store_module.TransactionStore(tmp_path)
    monkeypatch.setattr(agent_module, "store", test_store)
    monkeypatch.setattr(store_module, "store", test_store)

    a = agent_module.VoiceAgent()
    a.extractor.set_products(PRODUCTS)
    monkeypatch.setattr(a, "extractor", a.extractor)
    a.state.mode = agent_module.ARMED
    return a, test_store


def test_armed_agent_ignores_ordinary_chatter(fresh_agent):
    a, store_ = fresh_agent
    a._on_final("two samosas for fifty rupees", 0.9)
    assert store_.list() == []
    assert a.state.mode == "armed"


def test_wake_word_alone_opens_the_command_window(fresh_agent):
    a, store_ = fresh_agent
    a._on_final("merc", 0.9)
    assert a.state.mode == "listening"

    a._on_final("tea twenty rupees", 0.9)
    rows = store_.list()
    assert len(rows) == 1 and rows[0].item == "Tea" and rows[0].amount == 20
    assert a.state.mode == "armed"  # re-arms for the next customer


def test_wake_word_and_command_in_one_breath(fresh_agent):
    a, store_ = fresh_agent
    a._on_final("mark two samosas for fifty rupees", 0.9)
    rows = store_.list()
    assert len(rows) == 1 and rows[0].item == "Samosa" and rows[0].quantity == 2
    assert a.state.mode == "armed"


def test_command_window_expires(fresh_agent):
    import time

    a, _ = fresh_agent
    a._on_final("merc", 0.9)
    a.state.listening_until = time.time() - 1
    a._end_command_window()
    assert a.state.mode == "armed"


def test_wake_off_means_always_listening(fresh_agent):
    a, store_ = fresh_agent
    a.set_wake_enabled(False)
    a._on_final("coffee twenty rupees", 0.9)
    assert len(store_.list()) == 1


def test_cancel_removes_the_last_pending_sale(fresh_agent):
    a, store_ = fresh_agent
    a.set_wake_enabled(False)
    a._on_final("tea twenty rupees", 0.9)
    a._on_final("cancel", 0.9)
    assert store_.list() == []


# -- streaming session (the phone's mic, with a scripted recognizer) ------


class FakeRecognizer:
    """Stands in for Vosk: each fed chunk yields the next scripted result."""

    def __init__(self, script):
        self.script = list(script)
        self.current = ("partial", "")

    def AcceptWaveform(self, pcm):
        self.current = self.script.pop(0) if self.script else ("partial", "")
        return self.current[0] == "final"

    def Result(self):
        import json

        words = [{"word": w, "conf": 0.9} for w in self.current[1].split()]
        return json.dumps({"text": self.current[1], "result": words})

    def PartialResult(self):
        import json

        return json.dumps({"partial": self.current[1]})

    def FinalResult(self):
        """Vosk returns only audio it hasn't already delivered, then resets.
        A chunk already emitted as a final is not repeated."""
        import json

        if self.current[0] == "final":
            return json.dumps({"text": "", "result": []})
        return self.Result()

    def Reset(self):
        pass


@pytest.fixture
def session_factory(tmp_path, monkeypatch):
    from app import store as store_module
    from app.voice import agent as agent_module

    test_store = store_module.TransactionStore(tmp_path)
    monkeypatch.setattr(agent_module, "store", test_store)

    def make(script, wake_enabled=True):
        # new_recognizer takes the catalog vocabulary; the fake ignores it.
        monkeypatch.setattr(
            agent_module.engine,
            "new_recognizer",
            lambda phrases=None: FakeRecognizer(script),
        )
        return agent_module.StreamSession(agent_module.VoiceAgent(), wake_enabled), test_store

    return make


def _types(events):
    return [e["type"] for e in events]


def test_stream_wake_and_command_in_one_breath(session_factory):
    session, store_ = session_factory([("final", "merc two samosas for fifty rupees")])
    events = session.feed(b"\x00" * 3200)

    assert "wake" in _types(events) and "result" in _types(events)
    result = next(e for e in events if e["type"] == "result")
    assert result["accepted"] and result["transaction"]["item"] == "Samosa"
    assert len(store_.list()) == 1


def test_stream_ignores_speech_until_woken(session_factory):
    session, store_ = session_factory([("final", "two samosas for fifty rupees")])
    events = session.feed(b"\x00" * 3200)

    assert _types(events) == ["heard"] and events[0]["used"] is False
    assert store_.list() == []
    assert session.mode == "armed"


def test_stream_button_skips_the_wake_word(session_factory):
    session, store_ = session_factory([("final", "tea twenty rupees")])
    assert "listening" in _types(session.listen_now())

    events = session.feed(b"\x00" * 3200)
    result = next(e for e in events if e["type"] == "result")
    assert result["transaction"]["amount"] == 20
    assert len(store_.list()) == 1


def test_stream_partial_wake_opens_the_window(session_factory):
    session, _ = session_factory([("partial", "merc")])
    events = session.feed(b"\x00" * 3200)

    assert "partial" in _types(events) and "listening" in _types(events)
    assert session.mode == "listening"


def test_stream_window_expires_back_to_armed(session_factory):
    import time

    session, _ = session_factory([("partial", "merc"), ("partial", "")])
    session.feed(b"\x00" * 3200)
    session.listening_until = time.time() - 1
    events = session.feed(b"\x00" * 3200)

    assert "timeout" in _types(events) and session.mode == "armed"


def test_stream_wake_partial_then_command_is_not_swallowed(session_factory):
    """The window opens on the partial "merc"; the final for that same
    utterance must not be consumed as the command."""
    session, store_ = session_factory([
        ("partial", "merc"),
        ("final", "merc"),
        ("final", "two samosas for fifty rupees"),
    ])

    session.feed(b"\x00" * 3200)          # partial fires the wake word
    assert session.mode == "listening"

    events = session.feed(b"\x00" * 3200)  # the wake word's own final result
    assert session.mode == "listening", "window was spent on the wake word"
    assert not any(e["type"] == "result" for e in events)

    events = session.feed(b"\x00" * 3200)  # the actual order
    result = next(e for e in events if e["type"] == "result")
    assert result["accepted"] and result["transaction"]["item"] == "Samosa"
    assert len(store_.list()) == 1


def test_local_mic_wake_partial_then_command(fresh_agent):
    from app.voice import agent as agent_module

    a, store_ = fresh_agent
    a._arm_command_window("wake word")     # as a partial would
    a._on_final("merc", 0.9)               # same utterance, now final
    assert a.state.mode == agent_module.LISTENING
    assert store_.list() == []

    a._on_final("tea twenty rupees", 0.9)
    assert len(store_.list()) == 1 and store_.list()[0].item == "Tea"


# -- rate vs total -------------------------------------------------------


@pytest.mark.parametrize(
    "said,quantity,amount,unit_price",
    [
        # "each" makes the amount a rate
        ("two samosa each 50 rupees", 2, 100.0, 50.0),
        # a price spoken before the goods is a rate, count either side of it
        ("10 rupees 5 samosa", 5, 50.0, 10.0),
        ("10 rupees teas 15", 15, 150.0, 10.0),
        ("two samosas for fifty rupees each", 2, 100.0, 50.0),
        ("three tea per ten rupees", 3, 30.0, 10.0),
        # a price quoted before the goods, count after: also a rate
        ("10 rupees teas for 12", 12, 120.0, 10.0),
        ("twenty rupees coffee for three", 3, 60.0, 20.0),
        # totals stay totals
        ("two samosas for fifty rupees", 2, 50.0, None),
        ("tea 20 rupees", 1, 20.0, None),
        ("three coffee sixty", 3, 60.0, None),
        # a rate with a single item is just the price
        ("samosa 50 rupees each", 1, 50.0, None),
        ("50 rupees samosa", 1, 50.0, None),
        # catalog pricing reports the unit it used
        ("two teas", 2, 20.0, 10.0),
    ],
)
def test_rate_versus_total(extractor, said, quantity, amount, unit_price):
    txn = extractor.extract(said).transaction
    assert txn is not None, f"{said!r} was rejected"
    assert (txn.quantity, txn.amount, txn.unit_price) == (quantity, amount, unit_price)


def test_rate_does_not_apply_without_an_item(extractor):
    txn = extractor.extract("fifty rupees each").transaction
    assert txn.item is None and txn.amount == 50.0


def test_absurd_quantity_is_not_multiplied(extractor):
    """A misheard year or phone number must not become a 2000x bill."""
    txn = extractor.extract("2024 samosa each 50 rupees").transaction
    assert txn.quantity == 1 and txn.amount == 50.0


# -- items that aren't in the catalog ------------------------------------


def test_unknown_item_is_named_from_the_utterance(extractor):
    txn = extractor.extract("5 rupees 18 chocolate").transaction
    assert (txn.item, txn.quantity, txn.amount, txn.unit_price) == (
        "Chocolate", 18, 90.0, 5.0,
    )


def test_unknown_item_never_invents_a_price(extractor):
    """No amount spoken and no catalog entry means no transaction, rather than
    a sale for zero rupees."""
    result = extractor.extract("two chocolates")
    assert not result.ok and result.reason == "no amount heard"


def test_filler_words_are_not_mistaken_for_items(extractor):
    txn = extractor.extract("100 rupees please").transaction
    assert txn.item is None and txn.amount == 100.0


def test_bare_amount_stays_unnamed(extractor):
    txn = extractor.extract("hundred rupees").transaction
    assert txn.item is None and txn.quantity is None


# -- push to talk --------------------------------------------------------


def test_flush_ends_the_utterance_without_waiting_for_silence(session_factory):
    """Button released: the pending audio must resolve immediately."""
    session, store_ = session_factory([("partial", "tea twenty rupees")])
    session.listen_now()
    session.feed(b"\x00" * 3200)          # only a partial so far, no result yet

    events = session.flush()
    result = next(e for e in events if e["type"] == "result")
    assert result["accepted"] and result["transaction"]["amount"] == 20
    assert len(store_.list()) == 1


def test_flush_with_nothing_said_still_answers(session_factory):
    """The app waits for a result event before closing the mic, so silence
    has to produce one too."""
    session, store_ = session_factory([("partial", "")])
    session.listen_now()

    events = session.flush()
    result = next(e for e in events if e["type"] == "result")
    assert result["accepted"] is False and result["reason"] == "nothing heard"
    assert store_.list() == []


# -- mishearing repair ---------------------------------------------------

COLD = Product(name="Cold Coffee", price=40, aliases=["cold coffees"])


@pytest.fixture
def cafe() -> TransactionExtractor:
    return TransactionExtractor([*PRODUCTS, COLD])


@pytest.mark.parametrize(
    "misheard,item,quantity",
    [
        ("why cold coffees 700 rupees", "Cold Coffee", 5),   # five
        ("too cold coffee 80 rupees", "Cold Coffee", 2),     # two
        ("tan chai 100 rupees", "Tea", 10),                  # ten
        ("tree samosas 75 rupees", "Samosa", 3),             # three
        ("for samosas 100 rupees", "Samosa", 4),             # four
    ],
)
def test_misheard_counts_are_repaired(cafe, misheard, item, quantity):
    txn = cafe.extract(misheard).transaction
    assert (txn.item, txn.quantity) == (item, quantity)


def test_repair_only_fires_in_front_of_a_product(cafe):
    """"for 700 rupees" is a price, not four of something."""
    txn = cafe.extract("for 700 rupees").transaction
    assert txn.item is None and txn.amount == 700.0


def test_for_still_means_for_between_item_and_price(cafe):
    txn = cafe.extract("two samosas for fifty rupees").transaction
    assert (txn.quantity, txn.amount, txn.unit_price) == (2, 50.0, None)


def test_repair_leaves_the_raw_text_alone(cafe):
    """The merchant should still see what was actually heard."""
    txn = cafe.extract("too cold coffee 80 rupees").transaction
    assert txn.raw_text == "too cold coffee 80 rupees"


# -- recognizer vocabulary -----------------------------------------------


def test_vocabulary_covers_catalog_numbers_and_wake_word():
    from app.voice import grammar

    words = grammar.phrases_for([*PRODUCTS, COLD], "merc")
    for expected in ["merc", "mark", "five", "fifty", "hundred", "rupees",
                     "each", "samosa", "cold", "coffee", "chai"]:
        assert expected in words, f"{expected!r} missing from the vocabulary"
    assert words[-1] == "[unk]", "off-list speech needs somewhere to go"
    assert len(words) < 300, "a shop counter does not need a big vocabulary"


def test_unknown_markers_are_stripped_before_extraction(cafe):
    from app.voice.grammar import strip_unknown

    assert strip_unknown("[unk] two [unk] samosas") == "two samosas"
    txn = cafe.extract(strip_unknown("[unk] tea 20 rupees")).transaction
    assert txn.item == "Tea" and txn.amount == 20.0


# -- held button: one order, however many pauses --------------------------


def test_pause_mid_order_does_not_file_a_fragment(session_factory):
    """The exact failure: "two ... cold coffee" filed a two-rupee sale the
    moment the recognizer heard a pause after the count."""
    session, store_ = session_factory([
        ("final", "two"),          # recognizer decides the sentence ended
        ("final", "cold coffee"),  # ...but the merchant was still talking
    ])
    session.listen_now(buffered=True)

    session.feed(b"\x00" * 3200)
    assert store_.list() == [], "committed a fragment before the button was released"
    session.feed(b"\x00" * 3200)
    assert store_.list() == []

    events = session.flush()
    result = next(e for e in events if e["type"] == "result")
    assert result["transcript"] == "two cold coffee"
    rows = store_.list()
    assert len(rows) == 1
    assert (rows[0].item, rows[0].quantity, rows[0].amount) == ("Cold Coffee", 2, 80.0)


def test_three_fragments_still_make_one_sale(session_factory):
    session, store_ = session_factory([
        ("final", "fifteen"),
        ("final", "samosa"),
        ("final", "for 300 rupees"),
    ])
    session.listen_now(buffered=True)
    for _ in range(3):
        session.feed(b"\x00" * 3200)

    session.flush()
    rows = store_.list()
    assert len(rows) == 1
    assert (rows[0].item, rows[0].quantity, rows[0].amount) == ("Samosa", 15, 300.0)


def test_unbuffered_window_still_commits_on_silence(session_factory):
    """Hands-free has no button, so a pause has to end the order there."""
    session, store_ = session_factory([("final", "tea twenty rupees")])
    session.listen_now()
    session.feed(b"\x00" * 3200)
    assert len(store_.list()) == 1


# -- fragments are never sales -------------------------------------------


@pytest.mark.parametrize("fragment", ["two", "fifteen", "twenty", "three"])
def test_a_bare_count_is_not_a_sale(extractor, fragment):
    result = extractor.extract(fragment)
    assert not result.ok and "nothing saved" in result.reason


def test_a_bare_amount_with_rupees_is_still_a_sale(extractor):
    """The spec's own example: "100 rupees" with no item must work."""
    txn = extractor.extract("100 rupees").transaction
    assert txn.item is None and txn.amount == 100.0


def test_for_is_only_four_at_the_start_of_a_sentence(extractor):
    assert extractor.extract("for samosas 100 rupees").transaction.quantity == 4
    # "each for fifty" — a preposition, must not become a quantity of four
    txn = extractor.extract("two teas each for 50 rupees").transaction
    assert (txn.quantity, txn.amount) == (2, 100.0)

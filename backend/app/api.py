"""HTTP + WebSocket surface of the voice agent."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import date

from fastapi import APIRouter, Body, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect

from .config import settings
from .events import bus
from .models.product import Product
from .models.transaction import PaymentEvent, TextCommand, Transaction, TransactionStatus
from .store import catalog, store
from .voice import grammar
from .voice.agent import StreamSession, agent
from .voice.stt import engine

log = logging.getLogger(__name__)
router = APIRouter()


def _parse_day(value: str | None) -> date | None:
    if not value or value == "all":
        return None if value == "all" else date.today()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(400, f"date must be YYYY-MM-DD or 'all', got {value!r}")


# -- health & status -----------------------------------------------------


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "speech": engine.status(), "agent": agent.status()}


@router.get("/api/status")
def status() -> dict:
    return {
        "agent": agent.status(),
        "summary": store.summary(),
        "products": [p.model_dump() for p in catalog.products],
        "events": bus.history[-20:],
    }


# -- voice control -------------------------------------------------------


@router.post("/api/voice/start")
def voice_start() -> dict:
    return agent.start()


@router.post("/api/voice/stop")
def voice_stop() -> dict:
    return agent.stop()


@router.post("/api/voice/listen")
def voice_listen(seconds: float | None = Query(None, ge=1, le=60)) -> dict:
    """The activate button: capture one command, no wake word needed."""
    return agent.listen_now(seconds)


@router.post("/api/voice/wake")
def voice_wake(enabled: bool = Body(..., embed=True)) -> dict:
    return agent.set_wake_enabled(enabled)


@router.post("/api/voice/text")
def voice_text(command: TextCommand) -> dict:
    """Same pipeline as speech, typed. Useful for testing without a mic."""
    result = agent.handle_transcript(
        command.text, command.confidence, source="text", strip_wake_word=True
    )
    return {
        "accepted": result.ok,
        "reason": result.reason,
        "cancelled": result.cancel,
        "transaction": result.transaction.model_dump(mode="json") if result.transaction else None,
    }


@router.post("/api/voice/audio")
async def voice_audio(file: UploadFile = File(...)) -> dict:
    """Transcribe a WAV clip offline, then run it through the extractor.

    This is the path the browser button and the Flutter app use: record on the
    device, post the clip, get a transaction back.
    """
    if not engine.load():
        raise HTTPException(503, engine.error or "speech model unavailable")

    data = await file.read()
    if not data:
        raise HTTPException(400, "empty audio upload")

    try:
        phrases = grammar.phrases_for(catalog.products, settings.WAKE_WORD)
        utterance = await asyncio.to_thread(engine.transcribe_wav, data, phrases)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except Exception as exc:
        log.exception("transcription failed")
        raise HTTPException(500, f"transcription failed: {exc}")

    if not utterance.text:
        bus.publish("ignored", text="", reason="nothing recognised in the clip", source="audio")
        return {"accepted": False, "reason": "nothing recognised", "transcript": "", "transaction": None}

    bus.publish("heard", text=utterance.text, mode="audio", used=True)
    result = agent.handle_transcript(utterance.text, utterance.confidence, source="audio")
    return {
        "accepted": result.ok,
        "reason": result.reason,
        "cancelled": result.cancel,
        "transcript": utterance.text,
        "confidence": utterance.confidence,
        "transaction": result.transaction.model_dump(mode="json") if result.transaction else None,
    }


# -- transactions --------------------------------------------------------


@router.get("/api/transactions")
def list_transactions(
    day: str | None = Query(None, alias="date", description="YYYY-MM-DD, or 'all'"),
    status: TransactionStatus | None = None,
) -> list[Transaction]:
    return store.list(day=_parse_day(day), status=status)


@router.post("/api/transactions", status_code=201)
@router.post("/transactions", status_code=201, include_in_schema=False)
def create_transaction(transaction: Transaction) -> Transaction:
    """Ingest a transaction built elsewhere — e.g. the Flutter app's own
    on-device extractor syncing its queue."""
    saved = store.add(transaction)
    bus.publish(
        "transaction",
        transaction=saved.model_dump(mode="json"),
        source="sync",
        summary=store.summary(),
    )
    return saved


@router.patch("/api/transactions/{txn_id}/status")
def update_status(txn_id: str, status: TransactionStatus = Body(..., embed=True)) -> Transaction:
    txn = store.set_status(txn_id, status)
    if txn is None:
        raise HTTPException(404, "no transaction with that id")
    bus.publish("status", transaction=txn.model_dump(mode="json"), summary=store.summary())
    return txn


@router.delete("/api/transactions/{txn_id}", status_code=204)
def delete_transaction(txn_id: str) -> None:
    if not store.delete(txn_id):
        raise HTTPException(404, "no transaction with that id")
    bus.publish("deleted", id=txn_id, summary=store.summary())


@router.get("/api/summary")
def summary(day: str | None = Query(None, alias="date")) -> dict:
    return store.summary(_parse_day(day))


@router.post("/api/payments/match")
def match_payment(event: PaymentEvent, window_minutes: float = Query(10.0, ge=1, le=120)) -> dict:
    """Hand-off point for the payment-matching module.

    Post a CREDIT with an amount and a timestamp; if it lines up with a pending
    transaction inside the window, that transaction flips to PAID.
    """
    if event.direction.upper() != "CREDIT":
        return {"matched": False, "reason": "only CREDIT events settle a transaction"}

    txn = store.match_payment(event.amount, event.timestamp, window_minutes)
    if txn is None:
        return {"matched": False, "reason": "no pending transaction with that amount in the window"}

    updated = store.set_status(txn.id, TransactionStatus.paid)
    bus.publish("status", transaction=updated.model_dump(mode="json"), summary=store.summary())
    return {"matched": True, "transaction": updated.model_dump(mode="json")}


# -- products ------------------------------------------------------------


@router.get("/api/products")
def get_products() -> list[Product]:
    return catalog.products


@router.put("/api/products")
def put_products(products: list[Product]) -> list[Product]:
    updated = catalog.replace(products)
    agent.extractor.set_products(updated)
    bus.publish("products", count=len(updated))
    return updated


# -- live events ---------------------------------------------------------


@router.websocket("/ws/audio")
async def websocket_audio(ws: WebSocket) -> None:
    """The phone's microphone, streamed in.

    Send binary frames of 16-bit mono PCM at the server's sample rate (16 kHz
    by default). Send JSON to control it:

        {"action": "listen", "buffered": true}   button held: collect until flush
        {"action": "flush"}                  end the utterance now (button up)
        {"action": "wake", "enabled": false} always-listening, no wake word

    Events come back as JSON: partial, wake, listening, heard, result, state.
    """
    await ws.accept()

    if not engine.load():
        await ws.send_json({"type": "error", "message": engine.error or "speech model unavailable"})
        await ws.close()
        return

    session = StreamSession()
    await ws.send_json({"type": "hello", **session.state(), "sample_rate": engine.sample_rate})

    try:
        while True:
            message = await ws.receive()
            if message.get("type") == "websocket.disconnect":
                break

            if (pcm := message.get("bytes")) is not None:
                for event in await asyncio.to_thread(session.feed, pcm):
                    await ws.send_json(event)
                continue

            raw = message.get("text")
            if not raw:
                continue
            try:
                command = json.loads(raw)
            except ValueError:
                await ws.send_json({"type": "error", "message": "expected JSON or binary audio"})
                continue

            action = command.get("action")
            if action == "listen":
                events = session.listen_now(
                    command.get("seconds"), bool(command.get("buffered"))
                )
            elif action == "flush":
                events = session.flush()
            elif action == "wake":
                events = session.set_wake(bool(command.get("enabled", True)))
            else:
                events = [{"type": "error", "message": f"unknown action {action!r}"}]
            for event in events:
                await ws.send_json(event)

    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover
        log.debug("audio websocket closed: %s", exc)


@router.websocket("/ws")
async def websocket_events(ws: WebSocket) -> None:
    await ws.accept()
    queue = bus.subscribe()
    try:
        await ws.send_json({"type": "hello", "status": agent.status(), "summary": store.summary()})
        while True:
            event = await queue.get()
            await ws.send_json(event)
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # pragma: no cover
        log.debug("websocket closed: %s", exc)
    finally:
        bus.unsubscribe(queue)

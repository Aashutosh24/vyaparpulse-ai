"""A tiny pub/sub so the microphone thread can talk to websocket clients.

The mic runs in a plain thread; websockets live on the asyncio loop. Everything
crossing that boundary goes through here.
"""

from __future__ import annotations

import asyncio
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger(__name__)


class EventBus:
    def __init__(self, history: int = 50) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._subscribers: set[asyncio.Queue] = set()
        self._history: deque[dict] = deque(maxlen=history)

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    @property
    def history(self) -> list[dict]:
        return list(self._history)

    def publish(self, type_: str, **payload: Any) -> dict:
        """Safe to call from any thread."""
        event = {
            "type": type_,
            "at": datetime.now(timezone.utc).isoformat(),
            **payload,
        }
        if type_ != "partial":
            self._history.append(event)

        if self._loop is None or self._loop.is_closed():
            return event
        try:
            self._loop.call_soon_threadsafe(self._fan_out, event)
        except RuntimeError:  # loop shutting down
            pass
        return event

    def _fan_out(self, event: dict) -> None:
        for queue in list(self._subscribers):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                log.debug("dropping event for a slow subscriber")


bus = EventBus()

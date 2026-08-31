"""Smart Merchant Payment App — offline voice agent backend.

Run it:

    uvicorn app.main:app --reload

Then open http://127.0.0.1:8000 for the merchant console, or
http://127.0.0.1:8000/docs for the API.
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .api import router
from .config import settings
from .events import bus
from .store import catalog
from .voice.agent import agent
from .voice.stt import engine

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s  %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("voice-agent")

STATIC_DIR = Path(__file__).parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    bus.bind_loop(asyncio.get_running_loop())
    agent.extractor.set_products(catalog.products)

    if engine.load():
        log.info("speech model ready: %s", settings.MODEL_DIR)
        if os.getenv("VOICE_AUTOSTART", "0") == "1":
            # Off by default: the phone and the browser send their own audio,
            # and nobody wants a microphone opening on its own at startup.
            agent.start()
    else:
        log.warning("speech disabled — %s", engine.error)

    yield

    agent.stop()


app = FastAPI(
    title="Smart Merchant Payment App — Voice Agent",
    description=(
        "Offline speech to structured PENDING transactions. "
        f"Say '{settings.WAKE_WORD}' or press the button."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # the Flutter app talks to this from the same LAN
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def console():
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(index)
    return {"status": "ok", "docs": "/docs"}

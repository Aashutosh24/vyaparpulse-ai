from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers import transactions, payments

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Merchant Payment Detection Backend",
    description=(
        "Detects incoming payment messages (bank/UPI SMS or notifications) "
        "and matches them against PENDING transactions created by the "
        "voice-agent module."
    ),
    version="1.0.0",
)

# Wide-open CORS since the only client is the merchant's own Flutter app
# during the hackathon. Tighten this (specific origins) before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(payments.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
